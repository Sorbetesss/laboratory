setTimeout(function() {
  thing();
}, 500);

["a","b","c"].reduce(function(item, thing) {
  return thing + " " + item;
}, "letters:")

func(() => {
  thing();
}, identifier);

func(function() {
  thing();
}, this.props.timeout * 1000);

func((that) => {
  thing();
}, this.props.getTimeout());

func(() => {
  thing();
}, true);

func(() => {
  thing();
}, null);

func(() => {
  thing();
}, undefined);

func(() => {
  thing();
}, /regex.*?/);

compose((a) => {
  return a.thing;
}, b => b * b);

reallyLongLongLongLongLongLongLongLongLongLongLongLongLongLongMethod((f, g, h) => {
  return f.pop();
}, true);

// Don't do the rest of these

func(function() {
  thing();
}, true, false);

func(() => {
  thing();
}, {yes: true, cats: 5});

compose((a) => {
  return a.thing;
}, b => {
  return b + "";
});

compose((a) => {
  return a.thing;
}, b => [1, 2, 3, 4, 5]);

renderThing(a =>
  <div>Content. So much to say. Oh my. Are we done yet?</div>
,args);

