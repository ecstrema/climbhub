// @ts-nocheck

if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function (key, callback) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, callback(key));
  };
}
if (!Map.prototype.getOrInsert) {
  Map.prototype.getOrInsert = function (key, value) {
    if (this.has(key)) {
      return this.get(key);
    }
    this.set(key, value);
  };
}
