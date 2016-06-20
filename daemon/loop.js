const loop = (fn, delay) => {
  fn().then(() => {
    setTimeout(function() {
      loop(fn, delay);
    }, delay);
  });
}

module.exports = loop;
