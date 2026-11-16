/**
 * How far the date strip and the day pager reach from the day the Todo screen opens on. Both
 * use these, so day N of one is day N of the other, and the strip can follow a swipe of the
 * pager day for day.
 */
export const DAYS_BEFORE = 365;
// Due dates can be set far ahead, so they reach 5 years forward.
export const DAYS_AFTER = 365 * 5;
