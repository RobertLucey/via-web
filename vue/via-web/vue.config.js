module.exports = {
  chainWebpack(config) {
    // worker-loader needs compiler access, which Vue CLI's thread-loader hides.
    config.module.rule("js").exclude.add(/\.worker\.js$/);
    config.module
      .rule("road-worker")
      .test(/\.worker\.js$/)
      .use("worker-loader")
      .loader("worker-loader")
      .options({ filename: "js/roads.[contenthash:8].worker.js" })
      .end()
      .use("babel-loader")
      .loader("babel-loader");
  },
  devServer: {
    disableHostCheck: true,
  },
};
