module.exports = function(grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    aws: grunt.file.exists('conf/credentials.json') ? grunt.file.readJSON('conf/credentials.json').aws : grunt.file.readJSON('conf/credentials.json-dist').aws,

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
          'src/vendor/require.js',
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
    },
    jshint: {
      files: [
        '*.js',
        'src/*.js'
      ],
      options: {
        globals: {},
        esversion: 6
      }
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        options: {
          files: [
            'dist/voxbone-<%= process.env.version || pkg.version %>.js',
            'tests/spec/*/*Spec.js',
            'tests/spec/helpers/**/*Helper.js'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-aws');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('test', ["karma"]);

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
        process.env.version = major;
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
};
