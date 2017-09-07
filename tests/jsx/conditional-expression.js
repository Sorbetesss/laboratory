// There are two ways to print ConditionalExpressions: "normal mode" and
// "JSX mode". This is normal mode (when breaking):
//
//   test
//     ? consequent
//     : alternate;
//
// And this is JSX mode (when breaking):
//
//   test ? (
//     consequent
//   ) : (
//     alternate
//   );
//
// When non-breaking, they look the same:
//
//  test ? consequent : alternate;
//
// We only print a conditional expression in JSX mode if its test,
// consequent, or alternate are JSXElements.
// Otherwise, we print in normal mode.

// This ConditionalExpression has no JSXElements so it prints in normal mode.
// The line does not break.
normalModeNonBreaking ? "a" : "b";

// This ConditionalExpression has no JSXElements so it prints in normal mode.
// Its consequent is very long, so it breaks out to multiple lines.
normalModeBreaking
  ? johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa
  : "c";

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. The line does not break, so it does not contain
// parens.
<div>
  {a ? "b" : "c"}
</div>;

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. Because the consequent is very long, they are broken in
// multiple lines but no parens are added.
<div>
  {a
    ? johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa
    : "c"}
</div>;

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. Because the consequent is very long, they are broken in
// multiple lines but no parens are added.
<div>
  {a
    ? johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa
    : null}
</div>;

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. Because the alternate is very long, they are broken in
// multiple lines but no parens are added.
<div>
  {a
    ? "b"
    : johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa}
</div>;

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. Because the alternate is very long, they are broken in
// multiple lines but no parens are added.
<div>
  {a
    ? null
    : johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa}
</div>;

// This ConditionalExpression prints in normal mode even though its parent is a
// JSXExpressionContainer. Because the test is very long, they are broken in
// multiple lines but no parens are added.
<div>
  {johnJacobJingleHeimerSchmidtHisNameIsMyNameTooWheneverWeGoOutThePeopleAlwaysShoutThereGoesJohnJacobJingleHeimerSchmidtYaDaDaDaDaDaDa
    ? "b"
    : "c"}
</div>;

// This ConditionalExpression prints in JSX mode because its test is a
// JSXElement. It is non-breaking.
// Note: I have never, ever seen someone use a JSXElement as the test in a
// ConditionalExpression. But this test is included for completeness.
<div /> ? jsxModeFromElementNonBreaking : "a";

// This ConditionalExpression prints in JSX mode because its consequent is a
// JSXElement. It is non-breaking.
jsxModeFromElementNonBreaking ? <div /> : "a";

// This ConditionalExpression prints in JSX mode because its alternate is a
// JSXElement. It is non-breaking.
jsxModeFromElementNonBreaking ? "a" : <div />;

// This ConditionalExpression prints in JSX mode because its test is a
// JSXElement. It is breaking.
// Note: I have never, ever seen someone use a JSXElement as the test in a
// ConditionalExpression. But this test is included for completeness.
<div>
  <span>thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo</span>
</div>  ? (
  "jsx mode from element breaking"
) : (
  "a"
);

// This ConditionalExpression prints in JSX mode because its consequent is a
// JSXElement. It is breaking.
jsxModeFromElementBreaking ? (
  <div>
    <span>thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo</span>
  </div>
) : (
  "a"
);

// This ConditionalExpression prints in JSX mode because its alternate is a
// JSXElement. It is breaking.
jsxModeFromElementBreaking ? (
  "a"
) : (
  <div>
    <span>thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo</span>
  </div>
);

// This chain of ConditionalExpressions prints in JSX mode because the parent of
// the outermost ConditionalExpression is a JSXExpressionContainer. It is
// non-breaking.
<div>
  {a ? "a" : b ? "b" : "c"}
</div>;

// This chain of ConditionalExpressions prints in normal mode even though its parent is a
// JSXExpressionContainer. It is breaking.
<div>
  {a
    ? "a"
    : b
      ? "b"
      : thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo}
</div>;

// This chain of ConditionalExpressions prints in JSX mode because there is a
// JSX element somewhere in the chain. It is non-breaking.
cable ? "satellite" : public ? "affairs" : network ? <span id="c" /> : "dunno";

// This chain of ConditionalExpressions prints in JSX mode because there is a
// JSX element somewhere in the chain (in this case, at the end). It is
// breaking; notice the consequents and alternates in the entire chain get
// wrapped in parens.
cable ? (
  "satellite"
) : public ? (
  "affairs"
) : network ? (
  <div>
    <span>thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo</span>
  </div>
) : "dunno";

// This chain of ConditionalExpressions prints in JSX mode because there is a
// JSX element somewhere in the chain (in this case, at the beginning). It is
// breaking; notice the consequents and alternates in the entire chain get
// wrapped in parens.
cable ? (
  <div>
    <span>thisIsASongAboutYourPoorSickPenguinHeHasAFeverAndHisToesAreBlueButIfISingToYourPoorSickPenguinHeWillFeelBetterInADayOrTwo</span>
  </div>
) : sateline ? (
  "public"
) : affairs ? (
  "network"
) : "dunno";

// This chain of ConditionalExpressions prints in JSX mode because there is a
// JSX element somewhere in the chain. It is breaking; notice the consequents
// and alternates in the entire chain get wrapped in parens.
<div>
  {properties.length > 1 ||
  (properties.length === 1 && properties[0].apps.size > 1) ? (
    draggingApp == null || newPropertyName == null ? (
      <MigrationPropertyListItem />
    ) : (
      <MigrationPropertyListItem apps={Immutable.List()} />
    )
  ) : null}
</div>;
