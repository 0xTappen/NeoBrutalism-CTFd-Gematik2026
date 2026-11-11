const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    'pages/main': './assets/js/pages/main.js',
    'pages/challenges': './assets/js/pages/challenges.js',
    'pages/scoreboard': './assets/js/pages/scoreboard.js',
    'pages/stats': './assets/js/pages/stats.js',
    'pages/teams/private': './assets/js/pages/teams/private.js',
    'pages/notifications': './assets/js/pages/notifications.js',
    'pages/settings': './assets/js/pages/settings.js',
    'theme': './assets/css/main.scss'
  },
  output: {
    path: path.resolve(__dirname, 'static'),
    // CTFd backend appends .min to asset paths, so output files must end in .min.js
    filename: 'js/[name].min.js',
  },
  module: {
    rules: [
      {
        test: /\.mp3$/i,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 128 * 1024 } },
        generator: { dataUrl: { mimetype: 'audio/mpeg' } }
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      },
      {
        test: /\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader'
        ]
      }
    ]
  },
  plugins: [
    new MiniCssExtractPlugin({
      // CTFd loads css/main.css which resolves to css/main.min.css
      filename: 'css/main.min.css'
    })
  ]
};
