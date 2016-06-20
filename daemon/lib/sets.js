const intersection = (a, b) => {
  const _b = new Set([...b]);
  return new Set([...a].filter(x => _b.has(x)));
}

const equals = (a, b) => {
  const _a = new Set([...a]);
  const _b = new Set([...b]);
  if (_a.size !== _b.size) {
    return false;
  }
  var i;
  for (i of _a) {
    if (!_b.has(i)) {
      return false;
    }
  }
  return true;
}

module.exports = {
  intersection: intersection,
  equals: equals
};
