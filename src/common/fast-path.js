"use strict";

function getNodeHelper(path, count) {
  const s = path.stack;

  for (let i = s.length - 1; i >= 0; i -= 2) {
    const value = s[i];

    if (value && !Array.isArray(value) && --count < 0) {
      return value;
    }
  }

  return null;
}

module.exports = class FastPath {
  constructor(value) {
    this.stack = [value];
  }
  // The name of the current property is always the penultimate element of
  // this.stack, and always a String.
  getName() {
    const s = this.stack;
    const len = s.length;
    if (len > 1) {
      return s[len - 2];
    }
    // Since the name is always a string, null is a safe sentinel value to
    // return if we do not know the name of the (root) value.
    /* istanbul ignore next */
    return null;
  }
  // The value of the current property is always the final element of
  // this.stack.
  getValue() {
    const s = this.stack;
    return s[s.length - 1];
  }
  getNode(count) {
    return getNodeHelper(this, ~~count);
  }

  getParentNode(count) {
    return getNodeHelper(this, ~~count + 1);
  }

  // Temporarily push properties named by string arguments given after the
  // callback function onto this.stack, then call the callback with a
  // reference to this (modified) FastPath object. Note that the stack will
  // be restored to its original state after the callback is finished, so it
  // is probably a mistake to retain a reference to the path.
  call(callback, ...names) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];
    for (const name of names) {
      value = value[name];
      s.push(name, value);
    }
    const result = callback(this);
    s.length = origLen;
    return result;
  }

  // Similar to FastPath#call, except that the value obtained by
  // accessing this.getValue()[name1][name2]... should be array-like. The
  // callback will be called with a reference to this path object for each
  // element of the array.
  each(callback, ...names) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];

    for (const name of names) {
      value = value[name];
      s.push(name, value);
    }

    for (let i = 0; i < value.length; ++i) {
      if (i in value) {
        s.push(i, value[i]);
        // If the callback needs to know the value of i, call
        // path.getName(), assuming path is the parameter name.
        callback(this);
        s.length -= 2;
      }
    }

    s.length = origLen;
  }
  // Similar to FastPath#each, except that the results of the
  // callback function invocations are stored in an array and returned at
  // the end of the iteration.
  map(callback, ...names) {
    const s = this.stack;
    const origLen = s.length;
    let value = s[origLen - 1];

    for (const name of names) {
      value = value[name];
      s.push(name, value);
    }

    const result = new Array(value.length);

    for (let i = 0; i < value.length; ++i) {
      if (i in value) {
        s.push(i, value[i]);
        result[i] = callback(this, i);
        s.length -= 2;
      }
    }

    s.length = origLen;

    return result;
  }
};
