module.exports = {
  apps: [{
    name: 'servex',
    script: 'index.js',
    watch: ['Servex', 'index.js'],
    ignore_watch: ['node_modules', 'public', '.git'],
    env: {
      NODE_ENV: 'development'
    }
  }]
};
