h(f(g(() => {
  a
})))

deepCopyAndAsyncMapLeavesA(
  { source: sourceValue, destination: destination[sourceKey] },
  { valueMapper, overwriteExistingKeys }
)

deepCopyAndAsyncMapLeavesB(
  1337,
  { source: sourceValue, destination: destination[sourceKey] },
  { valueMapper, overwriteExistingKeys }
)

deepCopyAndAsyncMapLeavesC(
  { source: sourceValue, destination: destination[sourceKey] },
  1337,
  { valueMapper, overwriteExistingKeys }
)

function someFunction(url) {
  return get(url)
    .then(
      json => dispatch(success(json)),
      error => dispatch(failed(error))
    );
}

const mapChargeItems = fp.flow(
  l => l < 10 ? l: 1,
  l => Immutable.Range(l).toMap()
);

expect(new Range([0, 0], [0, 0])).toEqualAtomRange(new Range([0, 0], [0, 0]));
