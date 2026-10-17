const SHEET_HOURLY_PREDICTED = '23_year-hourly';
const SHEET_DAILY_PREDICTED = '22_year-daily';
const SHEET_SUMMARY = '21_year-summary';

var HOURLY_PREDICTED_HEADERS = ['date', 'hourOfDay', 'hourOfYear', 'demand','nuclearGeneration','wasteToEnergyGeneration', 'hydrogenUsage','hydrogenCharge','windGeneration', 'storageUsage','v2gUsage', 'mustRun', 'gasUsage', 'solarUsage', 'windUsage','storageSolarCharge', 'storageGasCharge', 'storageDischarge','v2gDischarge', 'curtailedEnergy', 'storageStateEnd', 'netDemand', 'missingEnergy','dfsUsed','hydrogenImported','solarToV2g'];

/**
 * Core Simulation Pipeline: Executes the chronological energy balancing logic.
 * This function dictates the specific "Order of Operations" for the energy model.
 * * @param {Object} in_data - The consolidated input package (Profiles + Parameters).
 * @return {Object} Hierarchical results: Hourly (Granular), Daily (Aggregated), Yearly (KPIs).
 */
function calculateYear(in_data) {
  // PHASE 1: NON-DISPATCHABLE GENERATION
  // Calculate wind/solar output and adjust demand based on "Must Run" sources.
  // These are external constraints we cannot control.
  hoursPreds = _calculateHourlyFixedGen(in_data.hoursGen, in_data.parameters);
  
  // PHASE 2: DEMAND SIDE MANAGEMENT (DSM)
  // Apply flexibility mechanisms (DFS) to shave peaks *before* dispatching expensive generation.
  _applyDfs(hoursPreds, in_data.parameters);
  
  // PHASE 3: TEMPORAL AGGREGATION
  // Aggregate hourly data to daily summaries to help the storage algorithm make longer-term decisions (inter-day shifting). 
  daysPreds = _calculateDailyFixedGen(hoursPreds, in_data.parameters);

  // PHASE 4: DISPATCH ENGINE (The Heavy Lifting)
  //  When to charge/discharge storage vs. running gas turbines.
  _calculateStorageAndGasUsage(hoursPreds, daysPreds, in_data.parameters);
  
  // PHASE 5: POST-PROCESSING
  // Roll up all granular data into high-level financial and environmental metrics.
  var yearlySummary = _calculateYearlySummary(daysPreds, in_data.parameters);

  return {
    hoursPreds,
    daysPreds,
    yearlySummary
  }
}

/**
 * Phase 1: Baseline Generation & Net Load Calculation.
 * Scales historical renewable profiles to match future capacities and determines
 * the initial "Net Demand" (Residual Load) before any storage or dispatchable generation.
 * @private
 */
function _calculateHourlyFixedGen(hoursGen, parameters) {
  return hoursGen.map(hour=> {//running on eace row from the raw-data-hourly
    var predictedHour = {
      'date': hour.date,
      'hourOfDay': hour.hourOfDay,
      'hourOfYear': hour.hourOfYear,
      // Demand Projection: Scaling historical load by the calculated growth factor
      'demand': hour.totalGen * parameters.futureDemandFactor,
      'mustRun':parameters.mustRun,
      'nuclearGeneration':parameters.nuclearCapacity,
      'wasteToEnergyGeneration':parameters.wasteToEnergyCapacity,
      'fossileGen':0,
      'solarCapacityFactor': hour.solarGen / parameters.solarCapacityRefYear,
      'windCapacityFactor': hour.windGeneration /parameters.windCapacityRefYear
    };

    predictedHour.date.setYear(parameters.currentYear);
    // Apply Future Capacities to the normalized profiles
    predictedHour.solarGen = predictedHour.solarCapacityFactor * parameters.solarCapacity;
    predictedHour.windGeneration = predictedHour.windCapacityFactor * parameters.windCapacity;
    // --- NET LOAD CALCULATION ---
    // Calculate the gap between Demand and Passive Generation.
    // Formula: Demand - (Nuclear + Waste + Solar + Wind + MustRunLegacy)
    var demand_gen_diff =predictedHour.demand 
                          -predictedHour.nuclearGeneration
                          -predictedHour.wasteToEnergyGeneration
                          -predictedHour.solarGen 
                          -predictedHour.windGeneration 
                          -predictedHour.mustRun
    // Split result into two physical states:
    // 1. Over-Generation: We have more renewable energy than we need (Potential for Storage Charging / Curtailment).
    predictedHour.fixedOverGen = Math.min(0, demand_gen_diff) * -1;
    // 2. Net Demand: The remaining load that MUST be solved by Batteries or Gas.
    predictedHour.netDemand = Math.max(0, demand_gen_diff);
    predictedHour.dfsUsed=0;
    return predictedHour
  });
}

/**
 * Phase 2: Demand Side Management (DSM) / Demand Response.
 * Implements a "Load Shifting" heuristic:
 * 1. Identifies the most critical peak hours of the year.
 * 2. Reduces demand in those hours (Peak Shaving).
 * 3. Shifts that consumed energy to the "greenest" or lowest-demand hour of the SAME day (Valley Filling).
 */
function _applyDfs(predictedHourly, parameters) {
  var dfsPeakHoursCount = parameters.dfsHoursPerYear; 
  var dfsReductionPerHour = parameters.dfsReductionPerHour;
  var currentYear = parameters.currentYear;

  // Filter only the relevant year to avoid indexing errors
  var yearlyHoursList = predictedHourly.filter(hour => hour.date.getFullYear() === currentYear);

  // Sort all hours by Net Demand (High to Low) to attack the biggest problems first.
  yearlyHoursList.sort((a, b) => b.netDemand - a.netDemand);

  // Select only the top N worst hours defined by the policy
  let dfsHours = yearlyHoursList.slice(0, dfsPeakHoursCount)
  dfsHours.forEach(hour=>{
    // Safety check: Don't reduce if demand is already negative/low
    if (hour.netDemand-dfsReductionPerHour > 0) {//look here
      
      // --- STEP A: PEAK SHAVING ---
      // Reduce the demand at the peak hour
      hour.netDemand-=dfsReductionPerHour
      hour.dfsAppliedDown = true; 
      hour.dfsUsed += dfsReductionPerHour ;
      
      // --- STEP B: VALLEY FILLING (Load Shifting) ---
      // We must move this energy to another time in the SAME DAY.

      // 1. Locate the start (Hour 00:00) of the specific day for the current peak hour.
      var tmp=hour.hourOfYear-1
      while(predictedHourly[tmp].hourOfDay>0){
       tmp-=1;
      }
      // 2. Scan the 24 hours of that specific day to find the best target hour.
      var lowdemendhour=predictedHourly[tmp];
      for(var i=0;i<24;i++){
        // Search Criteria: Find hour with LOWER Net Demand and HIGHER Renewable Surplus (FixedOverGen).
        if(lowdemendhour.netDemand>=predictedHourly[i+tmp].netDemand){
          if(lowdemendhour.fixedOverGen<=predictedHourly[i+tmp].fixedOverGen){
         lowdemendhour=predictedHourly[i+tmp];
       }}}
      
      // --- STEP C: ENERGY INJECTION ---
      // Add the shifted load to the chosen "best" hour.
      if (lowdemendhour.netDemand>0){
        // Scenario 1: Target hour still has demand. Just add the load.
        lowdemendhour.netDemand+=dfsReductionPerHour;
        lowdemendhour.dfsAppliedup=true;
        lowdemendhour.dfsUsed-=dfsReductionPerHour
        }
      else if( lowdemendhour.fixedOverGen<dfsReductionPerHour){
        // Scenario 2: Target hour has some surplus, but not enough to cover the new load.
        // We eat up all the surplus, and the remainder becomes new Net Demand.
        lowdemendhour.netDemand+=dfsReductionPerHour-lowdemendhour.fixedOverGen;
        lowdemendhour.fixedOverGen=0
        lowdemendhour.dfsAppliedup=true;
        lowdemendhour.dfsUsed-=dfsReductionPerHour

        }
      else{ 
        // Scenario 3: Target hour has huge surplus. We just reduce the wasted energy.
        // Net Demand remains 0. Ideally, this is what we want (using wasted sun/wind). 
        lowdemendhour.fixedOverGen-=dfsReductionPerHour; 
      lowdemendhour.dfsAppliedup=true;
      lowdemendhour.dfsUsed-=dfsReductionPerHour;}
    
    }
  
  })
  

}

/**
 * Phase 3: Temporal Aggregation (Hourly -> Daily).
 * Rolls up 8760 hourly data points into 365 daily summaries.
 * Essential for analyzing macro-trends (seasonal shifting) and initializing daily storage constraints.
 * * @return {Array<Object>} List of 365 Daily Summary objects.
 */
function _calculateDailyFixedGen(predictedHourly, parameters) {
  var days = {}
  predictedHourly.forEach(function(hour) {
    // Determine Day Index (1-365)
    var dayOfYear = Math.ceil(hour.hourOfYear/24);
    // --- INITIALIZATION ---
    // Create the accumulator object if this is the first hour encountered for this day.
    if (!(dayOfYear in days)) {
      days[dayOfYear] = {
        'date': hour.date,
        'dayOfYear': dayOfYear,
        
        // --- ENERGY ACCUMULATORS (Sum = MWh) ---
        'totalDemand': 0,
        'solarGen': 0,
        'windGeneration': 0,
        'nuclearGeneration': 0,
        'wasteToEnergyGeneration': 0,
        'totalFixedOverGen': 0, // Total wasted renewable energy (potential for storage)
        'totalNetDemand': 0,    // Total energy deficit to be filled by Fossils/Storage
        'fossileGen': 0,        // Baseline Fossil usage (before storage optimization)
        'dfsUsed': 0,

        // --- POWER PEAKS (Max = MW) ---
        'maxDemand': 0,
        'minDemand': Number.MAX_SAFE_INTEGER,
        'maxFixedOverGen': 0,
        'maxNetDemand': 0,      // The "scariest" hour of the day for the grid manager

        // --- TIMESTAMPS ---
        'hourOfMaxDemand': null,
        'hourOfMinDemand': null,
        'hourOfMaxFixedOverGen': null,
        'hourOfMaxNetDemand': null,
        
        // --- PLACEHOLDERS ---
        // These fields are initialized to 0 but calculated in the NEXT phase (Dispatch).
        'solarUsage':0,
        'windUsage':0,
        'mustRun':0,
        'gasUsage':0,
        'hydrogenUsage':0,
        'hydrogenCharge':0,
        'hydrogenImported':0,
        'storageDischarge':0,
        'v2gDischarge':0,
        'renewableConsumption': 0,
        'solarInToEnergy':0
      };
    }

    // --- AGGREGATION LOGIC ---
    var day = days[dayOfYear];
    // 1. Summing Energy (Integration over time)
    day.totalDemand += hour.demand;
    day.solarGen += hour.solarGen;
    day.windGeneration += hour.windGeneration;
    day.nuclearGeneration += hour.nuclearGeneration;
    day.wasteToEnergyGeneration += hour.wasteToEnergyGeneration;
    day.totalFixedOverGen += hour.fixedOverGen;
    day.totalNetDemand += hour.netDemand;
    day.dfsUsed += Math.max(0, hour.dfsUsed); // Only sum positive DFS applications
    
    // Note: At this stage, 'fossileGen' equals 'netDemand'. 
    // This represents the "Business As Usual" scenario assuming NO storage exists yet.
    day.fossileGen += hour.netDemand;

    // 2. Finding Peaks (Extrema tracking)
    if (hour.demand > day.maxDemand) {
      day.maxDemand = hour.demand;
      day.hourOfMaxDemand = hour.hourOfDay;
    }
    if (hour.demand < day.minDemand) {
      day.minDemand = hour.demand;
      day.hourOfMinDemand = hour.hourOfDay;
    }
    if (hour.fixedOverGen > day.maxFixedOverGen) {
      day.maxFixedOverGen = hour.fixedOverGen;
      day.hourOfMaxFixedOverGen = hour.hourOfDay;
    }
    if (hour.netDemand > day.maxNetDemand) {
      day.maxNetDemand = hour.netDemand;
      day.hourOfMaxNetDemand = hour.hourOfDay;
    }
  });

  // Convert the Hash Map back to a clean Array for easy iteration
  predictedDaily = [];
  for (var i = 1; i <= 365; ++i) {
    predictedDaily.push(days[i]);
  }
  return predictedDaily
}


/**
 * The "Brain" of the simulation (Dispatch Engine).
 * Solves the Unit Commitment problem using a heuristic approach (Greedy + Look-ahead).
 * * Logic Hierarchy:
 * 1. Daily Planning: Analyzes the day ahead to decide if Gas Charging is needed (Arbitrage).
 * 2. Renewable Integration: Absorbs Solar/Wind into Grid -> Battery -> V2G -> Hydrogen.
 * 3. Dispatch: Discharges storage to shave peaks, utilizing a "Low Battery" throttle mechanism.
 * 4. Fallback: Activates Fossil Generation only when all green resources are exhausted.
 */
function _calculateStorageAndGasUsage(hoursPreds, daysPreds, parameters) {

  // --- INITIALIZATION ---
  // Assume storage usage starts at 50% charge to avoid "Cold Start" bias
  var storageState = 0.5*(parameters.storageEnergy + parameters.minStorageEnergy);
  var v2gState=0.5*(parameters.v2gEnergy)
  parameters.totalHydrogenStorage=0

  // --- OUTER LOOP: DAILY PLANNING ---
  for (var i = 0; i < 365; ++i) { 
    var day = daysPreds[i];

    // State Carry-Over: Inherit battery state from the last hour of yesterday
    if (i!=0){
      storageState=daysPreds[i-1].storageStateEnd-parameters.storageEnergy*0.01;//yeasterday energy left minus 1%
      v2gState=daysPreds[i-1].v2gStateEnd;
    }
    
    // --- STEP 1: DAY-AHEAD ANALYSIS ---
    // Calculate averages to identify what constitutes a "Peak" for this specific day.
    day.avgDemand = day.totalDemand / 24;
    day.avgNetDemand = day.totalNetDemand / 24;
    day.overAvgDemand = 0
    day.overAvgNetDemand = 0
    
    // Scan day to quantify the "Peak Volume" (Energy above average)
    for (var j = i*24 ; j < (i+1)*24 ; ++j) {
      var h = hoursPreds[j];
      day.overAvgDemand += Math.max(0, h.netDemand - day.avgDemand);
      day.overAvgNetDemand += Math.max(0, h.netDemand - day.avgNetDemand);
    }

    // Determine how much renewable energy is wasted (Curtailed) and can be stored
    day.fixedChargingPotential = 
      day.totalFixedOverGen * parameters.storageEfficiency;

    // Estimate battery state after soaking up all free sun/wind
    day.expectedStorageStateDueToFixedCharging = Math.min(
      parameters.storageEnergy,
      storageState +v2gState+ (
        day.fixedChargingPotential * parameters.storageEfficiencySqrt
      )
    );

    // Heuristics for discharge aggressiveness
    day.storagePeakDemandReduction = Math.min(1, parameters.effectiveStorageEnergy / day.overAvgDemand);
    day.storagePeakNetDemandReduction = Math.min(
      1, 
      Math.max(0, parameters.effectiveStorageEnergy - day.overAvgDemand) / (day.overAvgNetDemand - day.overAvgDemand));
    
    // --- STEP 2: STRATEGIC GAS CHARGING ---
    // Decision: Should we burn gas at night to ensure full batteries for the evening peak?
    day.storageNetDemandReduction = 0;
    day.requiredGasCharging = 0;
    day.requiredGasGen = Math.max(0, day.totalNetDemand - day.fixedChargingPotential);
    day.maxGasGen = 0;
    day.maxHydrogenUsage=0;
    day.maxGasPlusHydrogen=0;
    day.maxStorageGen = 0;
    day.gasGen = 0;
    day.totalCurtailed = 0;
    day.missingEnergy = 0;
    day.storageUsage = 0;
    day.v2gUsage=0;
    
    if (day.fixedChargingPotential < day.overAvgNetDemand) {
      // Scenario: Not enough sun/wind to cover the evening peak.
      // Action: Plan to charge battery using gas during off-peak hours (Valley Filling).
       day.requiredGasCharging += Math.min(
        (day.overAvgNetDemand - day.fixedChargingPotential) / parameters.storageEfficiency,
        (parameters.storageEnergy
          - day.expectedStorageStateDueToFixedCharging
        ) / parameters.storageEfficiencySqrt
      );

      // Add the inefficiencies of charging with gas to the total gas requirement
      day.requiredGasGen += day.requiredGasCharging * (1-parameters.storageEfficiency);
    } else if (day.fixedChargingPotential > day.overAvgNetDemand) {
      // Scenario: Plenty of sun. No need for gas charging.
      // We can be more aggressive with demand reduction.
      day.storageNetDemandReduction = Math.min(
        1,
        (day.fixedChargingPotential - day.overAvgNetDemand) / (day.totalNetDemand - day.overAvgNetDemand)
      );
    }
    // By now the planning for storage is to at least be enough for peak shaving, and at most for net demand reduction
    day.expectedStorageState = day.expectedStorageStateDueToFixedCharging + day.requiredGasCharging * parameters.storageEfficiencySqrt;  
    
    day.storageStateStart = storageState;
    var leftToChargeFromGas = day.requiredGasCharging;
    var leftToChargeFromFixed = day.fixedChargingPotential / parameters.storageEfficiency;

    // --- INNER LOOP: HOURLY DISPATCH ---
    for (var j = i*24 ; j < (i+1)*24 ; ++j) {
      var v2gCapacity=parameters.v2gEnergy*0.2// Assumption: Only 20% of EV battery energy is available for the grid
      var h = hoursPreds[j];
      // Reset hourly flags
      h.storageSolarCharge = 0;
      h.storageGasCharge = 0;
      h.storageDischarge = 0;
      h.hydrogenUsage=0;
      h.hydrogenCharge=0;
      h.hydrogenImported=0;
      h.v2gDischarge=0;
      h.v2gUsage=0;
      h.solarToV2g=0;
      h.storageUsage = 0;
      h.fossileGen=h.netDemand;
      
      // --- A. CHARGING LOGIC (Renewables First) ---
      
      // 1. Charge Battery from Solar/Wind Surplus
      h.storageSolarCharge += Math.min(
          h.fixedOverGen, 
          parameters.storageCapacity,
          (parameters.storageEnergy - storageState) / parameters.storageEfficiencySqrt+parameters.v2gEnergy- v2gState
        );
      // 2. Charge V2G (first Priority)
      h.solarToV2g+=Math.min(
        h.storageSolarCharge,
        parameters.v2gEnergy-v2gState);
      h.storageSolarCharge-=h.solarToV2g;// Correct battery charge
      v2gState+=h.solarToV2g

      leftToChargeFromFixed -= h.storageSolarCharge;
      storageState += h.storageSolarCharge * parameters.storageEfficiencySqrt; //continue seach storagestate
      
      // 3. Charge Battery from Gas (Strategic)
      // Execute the plan derived in Step 1 (charging at night)
      h.storageGasCharge = Math.min( 
        Math.max(0, day.avgNetDemand - h.netDemand) / parameters.storageEfficiency,// Only charge if demand is low
        leftToChargeFromGas,
        parameters.storageCapacity - h.storageSolarCharge,//how much possible to charge more
        Math.max(0, (parameters.storageEnergy - storageState)/parameters.storageEfficiencySqrt  - leftToChargeFromFixed),//how mcuh place for energy left
      );

      storageState += h.storageGasCharge * parameters.storageEfficiencySqrt;
      h.fossileGen += h.storageGasCharge;
      leftToChargeFromGas -= h.storageGasCharge;
      // Accounting: "Negative Usage" = Charging
      h.storageUsage -=( h.storageSolarCharge + h.storageGasCharge)
      h.v2gUsage-=h.solarToV2g;

      // --- B. DISCHARGING LOGIC (Peak Shaving) ---
      
      var overDemand = Math.max(0, h.netDemand - day.avgDemand);
      var overNetDemand = Math.max(0, h.netDemand - day.avgNetDemand - overDemand)
      h.storageDischarge += Math.min(
        // Heuristic: Don't dump everything at once. Scale discharge based on how "severe" the peak is.
        day.storagePeakDemandReduction * overDemand
          + day.storagePeakNetDemandReduction * overNetDemand
          + day.storageNetDemandReduction * Math.min(h.netDemand, day.avgNetDemand),
        // other limitations:
        h.netDemand,
        Math.max(0,(storageState - parameters.minStorageEnergy)*parameters.storageEfficiencySqrt),
        parameters.storageCapacity
      );

      // THROTTLE MECHANISM: Low Battery Protection
      if (parameters.storageEnergy>0){
        var batteryLevel=storageState/parameters.storageEnergy;}
      else {batteryLevel=0}
      if (batteryLevel<0.7){
        // If battery is < 70%, slow down discharge linearly to conserve for emergencies
        h.storageDischarge=h.storageDischarge*(batteryLevel/0.7);
          // Use V2G to compensate for the throttled battery
          h.v2gDischarge=Math.min(
          day.storagePeakDemandReduction * overNetDemand,
          h.netDemand-h.storageDischarge,
          h.fossileGen-h.storageDischarge,
          v2gCapacity*0.25,//discharge rate equal to 1/4 from the total capacity
          v2gState);
      }
      
      // Execute Discharge
      storageState -= h.storageDischarge / parameters.storageEfficiencySqrt;
      v2gState-=h.v2gDischarge;

      if (h.storageDischarge > 0 && h.storageUsage < 0) {
        console.warn("charging and discharging at same hour", h);//v2g usage
      }
      h.v2gUsage+=h.v2gDischarge;
      h.storageUsage += h.storageDischarge;
      h.fossileGen -= (h.storageDischarge+h.v2gDischarge);

      // --- C. HYDROGEN LOGIC (Deep Storage) ---
      // 1. Hydrogen Discharge (Substitute for Gas)
      var gasReplaceByHydrogen= Math.min(h.fossileGen,Math.max( parameters.hydrogenImportCapacity,parameters.hydrogenStorage));
      h.fossileGen-=gasReplaceByHydrogen
      //take from storage or import hydrogen
      if(parameters.hydrogenImportCapacity>parameters.hydrogenStorage){
        h.hydrogenImported+=gasReplaceByHydrogen
      }
      else{parameters.hydrogenStorage-=gasReplaceByHydrogen }
      h.hydrogenUsage+=gasReplaceByHydrogen;

      if (h.fossileGen < 0) {
        Logger.log(h.fossileGen+h.storageDischarge+h.v2gDischarge)
        console.warn("h.gasGen is lower than 0", h);
      } else {
        day.gasGen += h.fossileGen+h.mustRun;
      }

      h.storageStateEnd = storageState;
      h.v2gStateEnd=v2gState
      
      // Update maxGasGen
      if (h.fossileGen > day.maxGasGen) {
        day.maxGasGen = h.fossileGen
      }
      if (h.hydrogenUsage > day.maxHydrogenUsage) {
        day.maxHydrogenUsage =h.hydrogenUsage
      }
      if (Math.max(0,h.hydrogenUsage)+h.fossileGen > day.maxGasPlusHydrogen) {
        day.maxGasPlusHydrogen =Math.max(0,h.hydrogenUsage)+h.fossileGen
      }
      if (h.storageDischarge> day.maxStorageGen){
        day.maxStorageGen = h.storageDischarge
      }
      
      // Calculate curtailed
      h.curtailedEnergy =h.fixedOverGen - h.storageSolarCharge-h.solarToV2g;
      h.solarUsage =Math.max(0,h.solarGen-h.storageSolarCharge-h.solarToV2g - h.curtailedEnergy);
      // 2. Hydrogen Charging (Spillover from Renewables)
      // Only happens if there is STILL overGen after Battery and V2G are full
      var curtailedToHydrogen=parameters.hydrogenEfficenty*
      Math.min(parameters.hydrogenProductionCapacity,h.curtailedEnergy);
      parameters.hydrogenStorage+=curtailedToHydrogen;
      h.curtailedEnergy-=curtailedToHydrogen/parameters.hydrogenEfficenty;
      h.hydrogenCharge+=curtailedToHydrogen
      h.windUsage=Math.min(h.windGeneration,h.demand);//new**
      
      // Logic Correction: If we charged from gas but also wasted solar later, we made a mistake.
      // This block retroactively fixes "Bad Planning" by swapping Gas-Charge for Solar-Charge.
      if (h.storageGasCharge > 0 && h.solarUsage > 0) {
        var shiftSolarUsageToStorage = Math.min(
        h.storageGasCharge,
        h.solarUsage,
        parameters.storageEnergy-storageState,//new***
        parameters.storageCapacity);//new***
        // Swap gas for solar (relabeling only: the same amount of energy enters the battery,
        // so storageState does NOT change - only the source label moves from gas to solar)
        h.solarUsage -= shiftSolarUsageToStorage;
        h.storageSolarCharge += shiftSolarUsageToStorage;
        h.storageGasCharge -= shiftSolarUsageToStorage;
      }
      h.gasUsage = h.fossileGen 
      if (h.fossileGen>1){
        h.gasUsage-=h.storageGasCharge
      }
      // FAIL STATE: Blackout / Unmet Demand
      h.missingEnergy = Math.max(0, 
                                    h.demand 
                                    -h.nuclearGeneration
                                    -h.wasteToEnergyGeneration 
                                    -h.windUsage
                                    -h.solarUsage 
                                    -h.gasUsage
                                    -h.mustRun
                                    -h.dfsUsed 
                                    -h.storageDischarge
                                    -h.v2gDischarge
                                    -h.hydrogenUsage-1);
      // Update Daily Aggregates
      day.solarInToEnergy+=h.solarUsage+h.storageSolarCharge;
      day.mustRun+=h.mustRun;
      day.totalCurtailed += h.curtailedEnergy;
      day.hydrogenCharge+=h.hydrogenCharge;
      day.hydrogenUsage+=h.hydrogenUsage;
      day.hydrogenImported+=h.hydrogenImported;
      day.missingEnergy += h.missingEnergy;
      day.storageUsage += Math.max(0, h.storageUsage);
      day.solarUsage+=h.solarUsage//new**
      day.windUsage+=h.windUsage//new**
      day.gasUsage+=h.gasUsage//new**
      day.v2gUsage+=h.v2gDischarge;//new***
      day.storageDischarge+=h.storageDischarge//new**
      day.v2gDischarge+=h.v2gDischarge;//new**
      day.renewableConsumption += h.wasteToEnergyGeneration+ h.solarUsage + h.windUsage+h.hydrogenUsage+h.storageDischarge+h.v2gDischarge+h.nuclearGeneration-h.storageGasCharge ; 
    }// End Hourly Loop

    day.storageStateEnd = storageState;
    day.hydrogenStorage=parameters.hydrogenStorage;
    day.v2gStateEnd=v2gState;
    parameters.totalHydrogenStorage+=parameters.hydrogenStorage;
  }
}

/**
 * Data Structure Factory: Standardizes the representation of physical quantities.
 * Couples a numerical magnitude with its measurement unit to prevent ambiguity (e.g., MW vs kW).
 * * @param {Number} value - The numerical amount (e.g., 500).
 * @param {String} units - The physical unit (e.g., "MW", "MWh", "%").
 * @return {Object} A structured object {value, units}.
 */
function Value(value, units) {
  return {
    "value": value,
    "units": units
  }
}

/**
 * Phase 5: Final Aggregation (Daily -> Yearly KPIs).
 * Generates the "Executive Summary" of the simulation.
 * Distinguishes between:
 * 1. ENERGY (MWh): Total amounts produced/consumed over the year (Sum).
 * 2. CAPACITY (MW): The maximum infrastructure size required to handle peak stress (Max).
 * * @return {Object} A dictionary of Value objects (value + units).
 */
function _calculateYearlySummary(daysPreds, parameters) {
  summary = {
    "maxGasCapacity": Value(0, "MW"),      // PEAK Load (Infrastructure size)
    "maxHydrogenUsageCapacity": Value(0, "MW"), 
    "maxStorageCapacity": Value(0, "MW"),
    "fossilCapacityWithMargin": Value(0, "MW"), // Planning requirement
    "gasPlusHydrogenWithMargin":Value(0,"MW"),
    "maxGasPlusHydrogen": Value(0, "MW"),
    "mustRun": Value(0, "MWh"),
    "nuclearGeneration": Value(0,"MWh"),
    "wasteToEnergyGeneration":Value(0,"MWh"),
    "fossilGeneration": Value(0, "MWh"),   // Total Fuel Burned
    "hydrogenGeneration":Value(0, "MWh"),
    "hydrogenImported":Value(0, "MWh"),//total hydrogen imported
    "solarGeneration": Value(0, "MWh"),
    "windGeneration": Value(0, "MWh"),
    "gasInToEnergy":Value(0, "MWh"),
    "solarInToEnergy":Value(0, "MWh"),
    "windInToEnergy":Value(0, "MWh"),
    "nuclearInToEnergy":Value(0, "MWh"),
    "wasteToEnergyInToEnergy":Value(0, "MWh"),
    "renewableConsumption": Value(0, "MWh"), // Green Energy actually used (not curtailed)
    "storageUtilization": Value(0, "MWh"),
    "v2gUsage":Value(0, "MWh"),
    "curtailedEnergy": Value(0, "MWh"),    // Wasted Green Energy
    "missingEnergy": Value(0, "MWh"),      // BLACKOUTS-supposed to be 0
    "renewableShare": Value(0, "%"),       // The main goal metric
    "dfsUsed": Value(0,"MWh"),
    "meanHydrogenStorage":Value(0,"MWh"),
    "hydrogenStorage":Value(0,"MWh"),
    "gasConsumption":Value(0,"BCM")        // Fuel Volume
  }
  daysPreds.forEach(function(day) {
    if (day.maxGasGen+parameters.mustRun > summary.maxGasCapacity.value) {
      summary.maxGasCapacity.value = day.maxGasGen+parameters.mustRun;
    }
    if (day.maxHydrogenUsage > summary.maxHydrogenUsageCapacity.value) {
      summary.maxHydrogenUsageCapacity.value = day.maxHydrogenUsage;
    }
    if (day.maxGasPlusHydrogen+parameters.mustRun > summary.maxGasPlusHydrogen.value) {
      summary.maxGasPlusHydrogen.value = day.maxGasPlusHydrogen+parameters.mustRun;
    }
    if (day.maxStorageGen > summary.maxStorageCapacity.value) {
      summary.maxStorageCapacity.value = day.maxStorageGen;
    }
    
    // ENERGY ACCUMULATION:
    summary.mustRun.value += day.mustRun;
    summary.fossilGeneration.value+=day.gasGen;
    summary.hydrogenGeneration.value+=day.hydrogenUsage;
    summary.hydrogenImported.value+=day.hydrogenImported;
    summary.nuclearGeneration.value+=day.nuclearGeneration;
    summary.wasteToEnergyGeneration.value+=day.wasteToEnergyGeneration
    summary.solarGeneration.value += day.solarGen;
    summary.windGeneration.value += day.windGeneration;
    summary.renewableConsumption.value += day.renewableConsumption;
    summary.storageUtilization.value += day.storageUsage;
    summary.v2gUsage.value += day.v2gUsage;
    summary.curtailedEnergy.value += day.totalCurtailed;
    summary.missingEnergy.value += day.missingEnergy;
    summary.dfsUsed.value+=day.dfsUsed;
    summary.gasInToEnergy.value+=day.gasUsage
    summary.solarInToEnergy.value+=day.solarInToEnergy
    summary.windInToEnergy.value+=day.windUsage
    summary.nuclearInToEnergy.value+=day.nuclearGeneration
    summary.wasteToEnergyInToEnergy.value+=day.wasteToEnergyGeneration
  
  });
  summary.fossilCapacityWithMargin.value = (summary.maxGasCapacity.value ) * 1.2;
  summary.gasPlusHydrogenWithMargin.value=(summary.maxGasPlusHydrogen.value)*1.2;
  summary.renewableShare.value = summary.renewableConsumption.value / (parameters.totalEnergyDemandYearly);
  var gasToElectricityFactor=0.0000002//the factor of how many gas requried for twh energy 
  summary.gasConsumption.value=summary.fossilGeneration.value*gasToElectricityFactor
  // Hydrogen Stats:
  summary.meanHydrogenStorage.value=parameters.totalHydrogenStorage/365;
  summary.hydrogenStorage.value=parameters.hydrogenStorage;
  return summary
}

/**
 * Reporting Orchestrator: Distributes simulation results to the appropriate storage handlers.
 * Ensures data is saved at all three levels of granularity:
 * 1. Micro: Hourly (Debug & Deep Analysis)
 * 2. Meso: Daily (Seasonal Patterns)
 * 3. Macro: Yearly (KPIs & Executive Summary)
 * * * @param {Object} in_data - The input parameters context.
 * @param {Object} results - Destructured object containing {hours, days, summary}.
 */
function savePredictions(in_data, {hoursPreds, daysPreds, yearlySummary}) {
  // Save High-Resolution Data (8760 rows)
  // Useful for technical validation and identifying specific peak hours.
  saveHourlyOutput(hoursPreds, in_data.parameters);

  // Save Aggregated Data (365 rows)
  // Useful for visualizing seasonal trends and storage behavior.
  saveDailyOutput(daysPreds, in_data.parameters);

  // Save Executive Summary (1 row)
  // The bottom line numbers used for decision making.
  saveSummary(yearlySummary, in_data.parameters);
};


/**
 * Hourly Data Exporter.
 * Writes the high-resolution simulation data (8760 rows) to the sheet.
 * * Feature: 'Debug Mode'
 * If parameters.debug is TRUE, it ignores the standard header list and dumps 
 * ALL internal properties of the hourly object. Great for troubleshooting new variables.
 */
function saveHourlyOutput(predictedHourly, parameters) {
  var headers = HOURLY_PREDICTED_HEADERS;
  if ('debug' in parameters && parameters.debug) {
    headers = []
    for (var k in predictedHourly[0]) {
      headers.push(k)
    }
  }
  writeToSheet(SHEET_HOURLY_PREDICTED, headers, predictedHourly);
}

/**
 * Daily Data Exporter.
 * Writes the aggregated daily data (365 rows).
 * Uses dynamic header generation based on the object keys.
 */
function saveDailyOutput(predictedDaily, parameters) {
  var headers = [];
  for (var k in predictedDaily[0]) {
    if (k == 'hours') {
      continue;
    }
    headers.push(k);
  }
  writeToSheet(SHEET_DAILY_PREDICTED, headers, predictedDaily);
}

/**
 * Executive Summary Exporter.
 * Creates the final report card.
 * CRITICAL FEATURE: 'Audit Trail' - It saves both the results AND the input parameters used.
 * This ensures that every result is reproducible and traced back to its specific configuration.
 */
function saveSummary(summary, parameters) {
  var rows = [];

  for (var v in summary) {
    rows.push([v, summary[v].units, summary[v].value]);
  }
  rows.push(['run details','','']);
  rows.push(['last calculation time', '', Date()]);

  
  rows.push(['Last Calculation Parameter Values','','']);  
  for (var parameterName in PARAMETER_TO_VARIABLE_NAME) {
    rows.push([parameterName, PARAMETERS_UNITS[parameterName], parameters[PARAMETER_TO_VARIABLE_NAME[parameterName]]]);
  }
  var outputSheet = getOrCreateSheet(SHEET_SUMMARY);
  outputSheet.getRange(3, 1, rows.length, 3).setValues(rows);
  rows.forEach(function(r, i) {
    if (r[0] === 'run details' || r[0] === 'Last Calculation Parameter Values') outputSheet.getRange(3 + i, 1, 1, 3).setFontWeight('bold');
  });
  // Remove leftovers of earlier, longer runs (the parameter list shrinks when parameters are removed).
  var firstStaleRow = 3 + rows.length;
  var staleRows = outputSheet.getMaxRows() - firstStaleRow + 1;
  if (staleRows > 0) outputSheet.getRange(firstStaleRow, 1, staleRows, 3).clearContent();
  // Title row (row 1) with the simulated year. Rows from 3 down are read by the run history, so row 1 is free.
  outputSheet.getRange(1, 1).setValue('output results - year ' + parameters.currentYear).setFontWeight('bold');
  outputSheet.getRange(2, 1, 1, 3).setValues([['name', 'units', 'value']]).setFontWeight('bold').setBackground('#eeeeee');
}
