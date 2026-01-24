// babel.config.cjs
module.exports = function (api) {
  api.cache(true);

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          extensions: [".tsx", ".ts", ".js", ".jsx", ".json"],
          alias: {
            "@": "./", // makes "@/..." resolve from project root
          },
        },
      ],

      // MUST be last
      "react-native-reanimated/plugin",
    ],
  };
};
