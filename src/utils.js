/**
 * Object Extension Utility (Mixin).
 * Copies properties from a source object to a target object.
 * * Engineering Concept: "Shallow Merge" & "In-Place Mutation"
 * Used to update configuration objects or state variables by overlaying new values 
 * on top of existing defaults.
 * * @param {Object} obj1 - The target object (will be modified!).
 * @param {Object} obj2 - The source object containing updates.
 * @returns {Object} - The modified target object (allows chaining).
 */
function update(obj1, obj2) {
  // 1. Iteration
  // Loop through every key in the source object.
  for (var key in obj2) {
    // 2. Safety Check (Prototype Chain Protection)
    // Ensures we only copy "own" properties, not properties inherited from the prototype.
    // This is defensive coding against pollution from libraries or base classes.
    if (obj2.hasOwnProperty(key)) {
      // 3. Assignment (Overwrite)
      // If key exists in obj1, it gets updated. If not, it gets added.
      obj1[key] = obj2[key];
    }
  }
  return obj1;
}
/**
 * Financial Calculation Utility (Amortization Engine).
 * Replicates the standard Excel PMT() function to calculate periodic payments.
 * * Engineering Context: "Levelized Cost Calculation"
 * Converts a lump-sum Capital Expenditure (CAPEX) into an equivalent annual flow (Annuity),
 * taking into account the interest rate (WACC) and the asset's lifespan.
 * * @param {number} ir   - Interest Rate per period (WACC).
 * @param {number} np   - Number of Periods (Asset Lifetime in years).
 * @param {number} pv   - Present Value (Total CAPEX).
 * @param {number} fv   - Future Value (Residual value, default = 0).
 * @param {number} type - Payment timing (0 = End of period, 1 = Beginning).
 * @returns {number}    - The calculated periodic payment (Annual Cost).
 */
function PMT(ir, np, pv, fv, type) {

    var pmt, pvif;

    // 1. Default Parameter Handling (Short-circuit evaluation)
    // If fv or type are missing/undefined, set them to 0.
    fv || (fv = 0);
    type || (type = 0);

    // 2. Singularity Handling (Edge Case)
    // If interest rate is 0, the standard formula divides by zero.
    // In this case, amortization is simply Total Cost / Years.
    if (ir === 0)
        return -(pv + fv)/np;

    // 3. Time Value of Money Logic
    // Calculate the Present Value Interest Factor using power function.
    pvif = Math.pow(1 + ir, np);

    // Standard Annuity Formula
    pmt = - ir * pv * (pvif + fv) / (pvif - 1);

    // Adjustment for payments made at the beginning of the period
    if (type === 1)
        pmt /= (1 + ir);

    return pmt;
}

/**
 * Financial Calculation Utility (Discounting Engine).
 * Calculates the Net Present Value (NPV) of a series of future cash flows.
 * * Engineering Context: "Time Value of Money"
 * Used to aggregate costs occurring in different years (e.g., 2030 vs 2050) 
 * into a single comparable value (Present Value), usually 2023 dollars.
 * * Formula: Sum( CashFlow[t] / (1 + r)^t )
 * * @param {number} rate - The discount rate (WACC), e.g., 0.05 for 5%.
 * @param {array} cashFlows - An array of values where index 0 is Year 0.
 * @return {number} - The total value of the project in today's terms.
 */
function NPV(rate, cashFlows) {
    var npv = 0;

    // Iterative Summation
    for (var i = 0; i < cashFlows.length; i++) {
        // Discounting Logic:
        // Money in the future is worth less than money today.
        // We divide the future amount by (1 + rate) raised to the power of the year offset.
        npv += cashFlows[i] / Math.pow(rate + 1, i);
    }

    return npv;
}

/**
 * Incremental NPV Accumulator.
 * Updates the running total of the Net Present Value with a single year's result.
 * * Engineering Optimization: "O(1) Complexity"
 * Instead of re-iterating over the entire history of cash flows (O(N)) every year,
 * this function adds just the specific contribution of the current year to the existing sum.
 * * Formula: NPV_new = NPV_old + (CashFlow_t / (1 + r)^t)
 * * @param {number} rate - Discount rate (WACC).
 * @param {number} lastNPV - The accumulated NPV up to the previous year.
 * @param {number} newCashFlow - The cost/revenue of the current year only.
 * @param {number} numYears - The time index (t) relative to the start.
 * @returns {number} - The updated cumulative NPV.
 */
function NPVcumulative(rate, lastNPV, newCashFlow, numYears) {
  // 1. Discount the specific new cash flow to Present Value
  // 2. Add to the accumulator
  return lastNPV + newCashFlow / Math.pow(rate + 1, numYears);
}

/**
 * Interpolation Dispatcher (Polymorphic Wrapper).
 * Acts as a single entry point for all interpolation logic.
 * * Engineering Principle: "Unified Interface"
 * Hides the complexity of choosing the right algorithm from the consumer.
 * Automatically detects input shape (1D List vs 2D Matrix) and delegates to the implementation.
 * * @param {Array} points - The dataset to interpolate (Numbers or Vectors).
 * @param {string} mode - The interpolation strategy (e.g., 'linear', 'step').
 * @returns {Array} - The interpolated result.
 */
function interpolate(points, mode) {
  // 1. Type Detection (Introspection)
  // Check the structure of the first element.
  // If the first element is ITSELF an array (e.g., [[2020, 10], [2030, 20]]),
  // then we are dealing with Multi-dimensional data (Matrix).
  if (Array.isArray(points[0])) {
    return interpolateMultidimensional(points, mode);
  // 2. Fallback to Simple Case
  // If not, it's a simple list of numbers (e.g., [10, 20, 30]).
  } else {
    return interpolateList(points, mode);
  }
};

/**
 * Multi-Dimensional Interpolator.
 * Generates intermediate data points for complex vectors (e.g., [Year, Solar, Wind, Storage]).
 * * Engineering Concept: "Vector Lerp (Linear Interpolation)"
 * Instead of calculating each technology separately, this function treats the entire scenario 
 * as a single mathematical vector and interpolates all dimensions simultaneously.
 * * @param {Array<Array>} points - List of keyframes (e.g., [[2020, 100, 50], [2030, 200, 80]]).
 * @param {string} mode - Strategy: "linear" (smooth gradient) or "step" (immediate jump).
 * @returns {Array<Array>} - The full timeline including generated years.
 */  
function interpolateMultidimensional(points, mode) {
  var result = [points[0]]; // Start with the first known point (Anchor)
  var numDimensions = points[0].length;// Detect vector size (Year + Techs)
  // 1. Iterate through the user-defined milestones (Keyframes)
  for (var k = 1; k < points.length; ++k) {
    var p = points[k]
    var lastP = points[k-1];
    // 2. Fill the gap between years (Time Loop)
    // Loop from Start Year + 1 up to Target Year - 1
    for (var i = lastP[0] + 1 ; i < p[0] ; ++i) {
      // 3. Calculate value for each technology (Dimension Loop)
      var newPoint = [i];
      for (var j = 1; j < numDimensions ; ++j) {
        if (mode === "step") {
        // Strategy A: Step Function (Discrete)
        // Values stay constant until the next milestone (good for policy changes).
          newPoint.push(lastP[j]);
        } else {
        // Strategy B: Linear Interpolation (Continuous)
        // Calculates the specific value on the line connecting Start and End.
          newPoint.push(lastP[j] + (i - lastP[0])*(p[j] - lastP[j])/(p[0] - lastP[0]));
        }
      }
      result.push(newPoint);
    }
    result.push(p);
  }
  return result;
};

/**
 * 1D List Interpolator.
 * Fills gaps in a simple sequence of numbers.
 * * Engineering Purpose: "Timeline Construction"
 * Used primarily to generate the full array of years (e.g., turning [2020, 2030] into 2020, 2021... 2030).
 * Supports 'step' mode for values that shouldn't change linearly.
 */
function interpolateList(points, mode) {
  var result = [points[0]];
  for (var k = 1; k < points.length; ++k) {
    var p = points[k]
    var lastP = points[k-1];
    // Iterate through the gap between two points
    for (var i = lastP + 1 ; i < p ; ++i) {
      // If mode is 'step', copy the previous value. Otherwise, use the index (i).
      result.push(mode === "step" ? lastP : i);
    }
    result.push(p);
  }
  return result;  
}

/**
 * Discretization / Quantization Utility.
 * Increments a value and snaps it to the nearest grid step.
 * * Engineering Purpose: "Search Space Reduction"
 * Essential for the optimization algorithm. It prevents the simulation from checking 
 * infinitely small increments. Instead of checking 1001MW, 1002MW... it jumps 1000MW -> 1050MW.
 * * Formula: floor((x + dx) / step) * step
 */
function increaseAndRound(number, increment, rounding) {
  // 1. Add increment
  // 2. Divide by step size (rounding)
  // 3. Truncate decimal part (Integer division)
  // 4. Multiply back by step size
  return Math.trunc((number+increment) / rounding) * rounding;
}

/**
 * Input Validation Helper.
 * Checks if a variable represents "nothingness" in any of its JS/Excel forms.
 * * Engineering Principle: "Robustness"
 * Unifies the check for undefined, null, and empty strings into a single reliable boolean.
 */
function isNull(someVar) {
  return someVar === undefined || someVar === null || someVar === '';
}