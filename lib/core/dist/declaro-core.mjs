var v = Object.defineProperty;
var f = (i, t, e) => t in i ? v(i, t, { enumerable: !0, configurable: !0, writable: !0, value: e }) : i[t] = e;
var o = (i, t, e) => (f(i, typeof t != "symbol" ? t + "" : t, e), e);
function x(i, t) {
  return {
    meta: i,
    context: t
  };
}
function p(i) {
}
class c {
  constructor(t, e) {
    o(this, "valid");
    o(this, "value");
    this.valid = Promise.resolve(t), this.value = e;
  }
  get invalid() {
    return new Promise(async (t, e) => {
      const r = await this.valid;
      t(!r);
    });
  }
  onValid(t) {
    return this.valid.then((r) => (r && t(this.value), r));
  }
  onInvalid(t) {
    return this.invalid.then((r) => (r && t(this.value), r));
  }
}
function u(i, ...t) {
  const e = y(i, ...t);
  return new c(e, i);
}
function d(i, ...t) {
  const e = m(i, ...t);
  return new c(e, i);
}
async function y(i, ...t) {
  for (const e of t)
    if (!await e(i))
      return !1;
  return !0;
}
async function m(i, ...t) {
  for (const e of t)
    if (await e(i))
      return !0;
  return !1;
}
class A {
  constructor() {
    o(this, "listeners", {});
  }
  getListeners(t) {
    return this.listeners[t] = Array.isArray(this.listeners[t]) ? this.listeners[t] : [], this.listeners[t];
  }
  on(t, e) {
    return this.getListeners(t).push(e), () => {
      const r = this.getListeners(t).indexOf(e), s = r > -1;
      return s && this.getListeners(t).splice(r, 1), s;
    };
  }
  async emitAsync(t, ...e) {
    await this.getListeners(t).reduce(async (r, s) => (await r, await s(...e)), Promise.resolve()).catch((r) => {
      console.error("Error in event listener", r);
    });
  }
  async emitAll(t, ...e) {
    await Promise.all(
      this.getListeners(t).map((r) => r(...e))
    );
  }
  emit(t, ...e) {
    this.getListeners(t).forEach((r) => r(...e));
  }
}
function w(i, ...t) {
  return t.reduce((e, r) => Reflect.ownKeys(r).reduce((s, l) => {
    let a = s[l], n = r[l];
    return Array.isArray(n) && Array.isArray(a) ? n = [...a, ...n] : Array.isArray(n) && !Array.isArray(a) ? n = [a, ...n].filter((h) => !!h) : Array.isArray(a) && !Array.isArray(n) && (n = [...a ?? [], n]), s[l] = n, s;
  }, e), i);
}
class V {
  constructor() {
    o(this, "state", {});
    o(this, "emitter", new A());
  }
  /**
   * Set a value in context, to be injected later.
   *
   * @param key
   * @param payload
   */
  provide(t, e) {
    const s = {
      value: e,
      key: t
    };
    this.state[t] = s;
  }
  /**
   * Extract a value from context.
   *
   * @param key
   * @returns
   */
  inject(t) {
    const e = this.state[t];
    if (e)
      return e.value;
  }
  /**
   * Ensure that only one copy of this instance exists in this context. Provides the instance if it doesn't exist yet, otherwise inject the cached instance.
   *
   * @param key
   * @param instance
   */
  singleton(t, e) {
    const r = this.inject(t);
    return r || (this.provide(t, e), e);
  }
  /**
   * Instantiate a ContextConsumer class
   *
   * @param Consumer
   * @returns
   */
  hydrate(t, ...e) {
    return new t(this, ...e);
  }
  /**
   * Create a new context from other instance(s) of Context
   *
   * @param contexts
   * @returns
   */
  extend(...t) {
    return t.reduce((e, r) => w(e, r.state), this.state);
  }
  /**
   * Modify context with middleware
   *
   * @param middleware
   * @returns
   */
  async use(...t) {
    return t.reduce(async (e, r) => {
      await e, await r(this);
    }, Promise.resolve(void 0));
  }
  /**
   * Validate context ensuring all validators are valid.
   *
   * @param validators
   * @returns
   */
  validate(...t) {
    return u(this, ...t);
  }
  /**
   * Validate context ensuring at least one validator is valid
   * @param validators
   * @returns
   */
  validateAny(...t) {
    return d(this, ...t);
  }
  /**
   * Add a callback to listen for an event in this context.
   *
   * @param event
   * @param listener
   * @returns
   */
  on(t, e) {
    return this.emitter.on(t, e);
  }
  /**
   * Emit an event in this context
   *
   * @param event
   * @param args
   * @returns
   */
  async emit(t, ...e) {
    return await this.emitter.emitAsync(t, this, ...e);
  }
}
class L {
  constructor(t, ...e) {
    this.context = t;
  }
}
class P {
  static all(...t) {
    return async (e) => u(e, ...t).valid;
  }
  static any(...t) {
    return async (e) => d(e, ...t).valid;
  }
}
async function C(i) {
  return await new Promise((t, e) => {
    setTimeout(() => {
      t(void 0);
    }, i);
  });
}
const E = "Hello World!";
export {
  V as Context,
  L as ContextConsumer,
  P as ContextValidator,
  A as EventManager,
  c as Validation,
  y as allValid,
  m as anyValid,
  x as defineApp,
  w as merge,
  C as sleep,
  p as startServer,
  E as test,
  u as validate,
  d as validateAny
};
