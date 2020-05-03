function memoize(fn) {
  const cache = [];
  const isEqual = (arr1, arr2) =>
    arr1.length === arr2.length && arr1.every((a, i) => a === arr2[i]);

  return (...args) => {
    const wasCalled = cache.filter(result => isEqual(result[0], args));
    if (wasCalled.length) {
      return wasCalled[0][1];
    }

    const execute = fn(args);
    cache.push([args, execute]);
    return execute;
  };
}

module.exports = memoize;
