module.exports = function (grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    aws: grunt.file.readJSON('conf/credentials.json').aws,

    concat: {
      options: {
        banner: '/*!\n' +
          ' * @license Voxbone v<%= pkg.version %>\n' +
          ' * Copyright <%= grunt.template.today("yyyy") %> Voxbone. All Rights Reserved.\n' +
          ' * Licensed under the Apache License, Version 2.0 (the "License") \n' +
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
        },
        sourceMap: true
      },
      voxbone: {
        src: '<%= concat.voxbone.dest %>',
        dest: 'dist/voxbone-<%= pkg.version %>.min.js'
      }
    },
    s3: {
      production: {
        options: {
          accessKeyId: '<%= aws.prod.accessKeyId %>',
          secretAccessKey: '<%= aws.prod.secretAccessKey %>',
          bucket: 'click2vox.com'
        },
        cwd: 'dist/',
        src: '*.js',
        dest: 'voxbone/'
      }
    },
    cloudfront: {
      options: {
        accessKeyId: '<%= aws.prod.accessKeyId %>',
        secretAccessKey: '<%= aws.prod.secretAccessKey %>',
        distributionId: '<%= aws.cloudfront.voxbone_distro %>'
      },
      voxbone: {
        options: {
          invalidations: [
            '/voxbone/*.js'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-aws');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('build-js', ['concat:voxbone', 'uglify:voxbone']);
  grunt.registerTask('dist', ['s3:production', 'cloudfront:voxbone']);
}
