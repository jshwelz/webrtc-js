module.exports = function(grunt) {
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
          'src/vendor/jssip-2.0.6.js',
          'src/vendor/socket.io-1.4.5.js',
          'src/vendor/sha_dev-1.5.0.js',
          'src/vendor/callstats.min.js',
          'src/misc.js',
          'src/voxbone.js'
        ],
        dest: 'dist/voxbone-<%= process.env.version || pkg.version %>.js'
      }
    },
    uglify: {
      options: {
        preserveComments: function(node, comment) {
          if (/@(preserve|license|cc_on)/.test(comment.value))
            return true;
        },
        sourceMap: true
      },
      voxbone: {
        src: '<%= concat.voxbone.dest %>',
        dest: 'dist/voxbone-<%= process.env.version || pkg.version %>.min.js'
      }
    },
    s3: {
      production: {
        options: {
          accessKeyId: '<%= aws.prod.accessKeyId %>',
          secretAccessKey: '<%= aws.prod.secretAccessKey %>',
          bucket: 'cdn-voxbone-com'
        },
        cwd: 'dist/',
        src: ['*.js', '*.map'],
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
            '/voxbone/*'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-aws');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  grunt.registerTask('clear-version', 'Reset version variable in process.env', function() {
    delete process.env.version;
  });

  grunt.registerTask('build-version', 'Generates a version of voxbone.js library', function(type) {
    var pkg = grunt.config.data.pkg;
    var version = pkg.version.split('.');

    var major = version[0],
      minor = version[1];

    switch (type) {
      case 'major':
        process.env.version = major
        break;
      case 'minor':
        process.env.version = major + '.' + minor;
        break;
      case 'patch':
        process.env.version = pkg.version;
        break;
    }
    grunt.task.run(['build-js', 'clear-version']);
  });

  grunt.registerTask('build-js', ['concat:voxbone', 'uglify:voxbone']);
  grunt.registerTask('dist', ['s3:production', 'cloudfront:voxbone']);
}
