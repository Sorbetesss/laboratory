interface foo1 {
  bar/* foo */ ? /* bar */ (/* baz */) /* bat */;
}

interface foo2 {
  bar/* foo */ ? /* bar */ (bar: /* baz */ string): /* bat */ string;
}

interface foo3 {
  /* foo */ (/* bar */): /* baz */ string;
}

interface foo4 {
  /* foo */ (bar: /* bar */ string): /* baz */ string;
}

interface foo5 {
  /* foo */ new /* bar */  (a: /* baz */ string): /* bat */ string
}

interface foo6 {
  /* foo */ new /* bar */ (/* baz */): /* bat */ string
}

type foo7 = /* foo */ (/* bar */) /* baz */ => void

type foo8 = /* foo */ (a: /* bar */ string) /* baz */ => void

let foo9: new /* foo */ (/* bar */) /* baz */ => string;

let foo10: new /* foo */ (a: /* bar */ string) /* baz */ => string;
