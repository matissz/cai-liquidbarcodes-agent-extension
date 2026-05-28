const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/module.ts',
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: 'bundle.js',
    libraryTarget: 'commonjs2'
  },
  target: 'node',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.build.json')
          }
        },
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  externals: {
    '@cognigy/extension-tools': '@cognigy/extension-tools'
  }
};
