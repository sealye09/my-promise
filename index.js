const isFunction = (obj) => typeof obj === "function";
const isObject = (obj) => !!(obj && typeof obj === "object");
const isThenable = (obj) => (isFunction(obj) || isObject(obj)) && "then" in obj;
const isPromise = (promise) => promise instanceof MyPromise;

const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

class MyPromise {
  constructor(excutor) {
    this.result = null;
    this.state = PENDING;
    this.callbacks = [];

    /**
     * 状态转移后执行 callbacks
     * @param {*} state
     * @param {*} result
     * @returns
     */
    const changeState = (state, result) => {
      if (this.state !== PENDING) return;
      this.state = state;
      this.result = result;
      setTimeout(() => handleCallbacks(this.callbacks, state, result));
    };

    const onRejected = (reason) => changeState(REJECTED, reason);

    const onFulfilled = (value) => changeState(FULFILLED, value);

    let ignore = false;
    const resolve = (value) => {
      if (ignore) return;
      ignore = true;
      resolvePromise(this, value, onFulfilled, onRejected);
    };

    const reject = (reason) => {
      if (ignore) return;
      ignore = true;
      onRejected(reason);
    };

    try {
      excutor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const callback = { onFulfilled, onRejected, resolve, reject };

      // 如果当前状态还是 pending 状态，将回调函数存储起来：考虑回调的执行时机：状态转移后
      if (this.state === PENDING) {
        this.callbacks.push(callback);
      } else {
        // 如果当前状态已经是 fulfilled 或者 rejected 状态，异步执行回调函数
        setTimeout(() => handleCallback(callback, this.state, this.result));
      }
    });
  }

  resolve(value) {
    if (isPromise(value)) return value;
    if (isThenable(value)) return new MyPromise((resolve, reject) => value.then);
    return new MyPromise((resolve, _) => resolve(value));
  }

  reject(reason) {
    return new MyPromise((_, reject) => reject(reason));
  }

  /**
   * 捕获错误，相当于执行.then的第二个参数 onRejected
   * @param {*} onRejected
   */
  catch(onRejected) {
    return this.then(null, onRejected);
  }

  /**
   * 不管成功还是失败，都会执行的回调
   * @param {*} onFinally
   */
  finally(onFinally) {
    return this.then(onFinally, onFinally);
  }

  all(promises) {
    return new MyPromise((resolve, reject) => {
      if (!Array.isArray(promises)) {
        return reject(new TypeError("argument must be an array"));
      }
      if (promises.length === 0) return resolve(promises);

      const result = [];
      let count = 0;

      promises.forEach((pro, index) => {
        if (isPromise(pro)) {
          pro.then(
            (value) => {
              result[index] = value;
              count++;
              if (count === promises.length) resolve(result);
            },
            (reason) => {
              reject(reason);
            }
          );
        } else {
          result[index] = pro;
          count++;
          if (count === promises.length) resolve(result);
        }
      });
    });
  }

  race(promises) {
    return new MyPromise((resolve, reject) => {
      if (!Array.isArray(promises)) {
        return reject(new TypeError("argument must be an array"));
      }
      if (promises.length === 0) return resolve(promises);

      promises.forEach((pro) => {
        if (isPromise(pro)) {
          pro.then(resolve, reject);
        } else {
          resolve(pro);
        }
      });
    });
  }
}

/**
 * 处理单个回调函数
 * @param {*} callback promise回调数组中的单个回调
 * @param {FULFILLED | REJECTED} state promise的状态
 * @param {*} result promise的结果
 */
const handleCallback = (callback, state, result) => {
  const { onFulfilled, onRejected, resolve, reject } = callback;
  try {
    if (state === FULFILLED) {
      // 情况1：.then(1) onFulfilled 不是函数，直接将结果传递下去
      // 情况2：.then(() => {}) onFulfilled 是函数，执行函数(拿到返回值)，将结果传递下去
      isFunction(onFulfilled) ? resolve(onFulfilled(result)) : resolve(result);
    }
    if (state === REJECTED) {
      isFunction(onRejected) ? resolve(onRejected(result)) : reject(result);
    }
  } catch (error) {
    reject(error);
  }
};

/**
 * 处理回调函数数组
 * @param {*} callbacks
 * @param {FULFILLED | REJECTED} state promise的状态
 * @param {*} result
 */
const handleCallbacks = (callbacks, state, result) => {
  while (callbacks.length) handleCallback(callbacks.shift(), state, result);
};

/**
 * 处理 promise 的结果
 * @param {MyPromise} promise
 * @param {*} result
 * @param {*} resolve
 * @param {*} reject
 * @returns
 */
const resolvePromise = (promise, result, resolve, reject) => {
  // 1. 如果 result 等于 promise，循环引用，报错
  if (result === promise) {
    const reason = new TypeError("Can not fufill promise with itself");
    return reject(reason);
  }

  // 2. 如果 result 是 promise，那么执行这个 promise，将结果传递下去
  if (isPromise(result)) {
    return result.then(resolve, reject);
  }

  // 3. 如果 result 是对象或者函数 (thenable指的是具有then方法的对象或函数)
  if (isThenable(result)) {
    try {
      const then = result.then;
      // 4. 如果 then 是函数，那么执行 then，将结果传递下去
      if (isFunction(then)) {
        return new MyPromise(then.bind(result)).then(resolve, reject);
      }
    } catch (error) {
      return reject(error);
    }
  }

  return resolve(result);
};

module.exports = MyPromise;

MyPromise.deferred = function () {
  const result = {};
  result.promise = new MyPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};

module.exports = MyPromise;
