const PENDING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

const isFunction = (fn) => typeof fn === "function";
const isObject = (obj) => typeof obj === "object" && obj !== null;
const isThenable = (obj) => (isObject(obj) || isFunction(obj)) && "then" in obj;

function runMicroTask(fn) {
  if (process && process.nextTick) {
    return process.nextTick(fn);
  } else if (window && MutationObserver) {
    const observer = new MutationObserver(fn);
    const textNode = document.createTextNode("1");
    observer.observe(textNode, { characterData: true });
    textNode.data = "2";
  } else {
    setTimeout(fn);
  }
}

// 是
function resolvePromise(promise, x, resolve, reject) {
  if (promise === x) return reject(new TypeError("Chaining cycle detected for promise"));

  let called = false;

  if (isThenable(x)) {
    try {
      const then = x.then;
      if (isFunction(then)) {
        then.call(
          x,
          (y) => {
            if (called) return;
            called = true;
            resolvePromise(promise, y, resolve, reject);
          },
          (r) => {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } else {
        resolve(x);
      }
    } catch (err) {
      if (called) return;
      called = true;
      reject(err);
    }
  } else {
    resolve(x);
  }
}

class MyPromise {
  #PromiseState = PENDING;
  #PromiseResult = undefined;
  #onFulfilledCallbacks = [];
  #onRejectedCallbacks = [];

  #isPending = this.#PromiseState === PENDING;

  #changeState(state, result) {
    if (this.#isPending) {
      this.#PromiseState = state;
      this.#PromiseResult = result;
    }
  }

  constructor(executor) {
    const resolve = (result) => {
      if (this.#isPending) {
        this.#changeState(FULFILLED, result);
        this.#onFulfilledCallbacks.forEach((fn) => fn(result));
      }
    };

    const reject = (reason) => {
      if (this.#isPending) {
        this.#changeState(REJECTED, reason);
        this.#onRejectedCallbacks.forEach((fn) => fn(reason));
      }
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  then(onFulfilled, onRejected) {
    const promise2 = new MyPromise((resolve, reject) => {
      const handleFulfilled = () => {
        runMicroTask(() => {
          try {
            if (isFunction(onFulfilled)) {
              const data = onFulfilled(this.#PromiseResult);
              resolvePromise(promise2, data, resolve, reject);
            } else {
              resolve(this.#PromiseResult);
            }
          } catch (err) {
            reject(err);
          }
        });
      };

      const handleRejected = () => {
        runMicroTask(() => {
          try {
            if (isFunction(onRejected)) {
              const data = onRejected(this.#PromiseResult);
              resolvePromise(promise2, data, resolve, reject);
            } else {
              reject(this.#PromiseResult);
            }
          } catch (err) {
            reject(err);
          }
        });
      };

      switch (this.#PromiseState) {
        case FULFILLED:
          handleFulfilled();
          break;
        case REJECTED:
          handleRejected();
          break;
        case PENDING:
          this.#onFulfilledCallbacks.push(handleFulfilled);
          this.#onRejectedCallbacks.push(handleRejected);
          break;
      }
    });

    return promise2;
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finially(fn) {
    return this.then(
      (value) => {
        fn();
        return value;
      },
      (reason) => {
        fn();
        throw reason;
      }
    );
  }
}

MyPromise.deferred = function () {
  let result = {};
  result.promise = new MyPromise((resolve, reject) => {
    result.resolve = resolve;
    result.reject = reject;
  });
  return result;
};

module.exports = MyPromise;
