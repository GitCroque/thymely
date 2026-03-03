module.exports = () => {
  return {
    postcssPlugin: "replace-deprecated-color-adjust",
    Declaration(decl) {
      if (decl.prop === "color-adjust") {
        decl.prop = "print-color-adjust";
      }
    },
  };
};

module.exports.postcss = true;
