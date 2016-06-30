module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {
        banner: '/*!\n' +
          ' * @license Voxbone v<%= pkg.version %>\n' +
          ' * Copyright <%= grunt.template.today("yyyy") %> Voxbone. All Rights Reserved.\n' +
          ' * Licensed under the Apache License, Version 2.0 (the "License")\n' +
          ' */'
      },

      voxbone: {
        src: [
          'src/vendor/jssip-voxbone-0.7.9.js',
          'src/vendor/socket.io-1.4.5.js',
          'src/vendor/sha-1.5.0.js',
          'src/vendor/callstats.min.js',
          'src/voxbone.js'
        ],
        dest: 'dist/voxbone-<%= pkg.version %>.js'
      }
    },
    uglify: {
      options: {
        preserveComments: function (node, comment) {
          if (/@(preserve|license|cc_on)/.test(comment.value))
            return true;
        }
      },
      voxbone: {
        src: '<%= concat.voxbone.dest %>',
        dest: 'dist/voxbone-<%= pkg.version %>.min.js'
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('dist-js', ['concat:voxbone', 'uglify:voxbone']);
}
