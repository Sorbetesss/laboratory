run_spec(import.meta, ["vue"], { trailingComma: "none" });
run_spec(import.meta, ["vue"], { trailingComma: "es5" });
run_spec(import.meta, ["vue"], { semi: false });
run_spec(import.meta, ["vue"], {
  semi: false,
  experimentalOperatorPosition: true,
});
