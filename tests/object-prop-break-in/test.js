const a = classnames({
  "some-prop": this.state.longLongLongLongLongLongLongLongLongTooLongProp
});

const b = classnames({
  "some-prop": this.state.longLongLongLongLongLongLongLongLongTooLongProp === true
});

const o = {
  somethingThatsAReallyLongPropName:
    this.props.cardType === AwesomizerCardEnum.SEEFIRST,
};

const c = classnames({
  "some-prop": [ "foo", "bar", "foo", "bar", "foo", "bar", "foo", "bar", "foo" ]
});

const d = classnames({
  "some-prop": () => {}
});

const e = classnames({
  "some-prop": function bar() {}
});

const f = classnames({
  "some-prop": { foo: "bar", bar: "foo", foo: "bar", bar: "foo", foo: "bar" }
});

const g = classnames({
  "some-prop": longLongLongLongLongLongLongLongLongLongLongLongLongTooLongVar || 1337
});
