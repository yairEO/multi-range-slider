var gulp         = require('gulp'),
    gutil        = require('gulp-util'),
    watch        = require('gulp-watch'),
    cache        = require('gulp-cached'),
    gulp_if      = require('gulp-if'),
    runSequence  = require('run-sequence'),

    sourcemaps   = require('gulp-sourcemaps'),
    //debug      = require('gulp-debug'),
    sass         = require('gulp-sass'),
    csso         = require('gulp-csso'),
    combineMq    = require('gulp-combine-mq'),
    cssGlobbing  = require('gulp-css-globbing'),
    autoprefixer = require('gulp-autoprefixer'),

    umd          = require('gulp-umd'),
    uglify       = require('gulp-uglify'),
    rename       = require('gulp-rename'),
    concat       = require('gulp-concat'),
    eslint       = require('gulp-eslint'),

    replace      = require('gulp-replace'),
    insert       = require('gulp-insert'),
    beep         = require('beepbeep');


//////////////////////////////////////
var NAME = 'multi-range';

var uglifyOptions = {
    compress: {
        sequences    : true,
        conditionals : true,
        booleans     : true,
        unused       : true,
        if_return    : true,
        join_vars    : true,
        properties   : true,
        dead_code    : true
    },
    mangle      : true,
    "screw-ie8" : true
};

var eslint_settings = {
    rulePaths: [],
    rules: {
        "no-mixed-spaces-and-tabs" : [2, "smart-tabs"],
        "block-spacing"            : [2, "always"],
        "comma-style"              : [2, "last"],
        "no-debugger"              : [1],
        "no-alert"                 : [1],
        "indent"                   : [1, 4, {"SwitchCase":1}],
        'strict'                   : 0,
        'no-undef'                 : 1
    },
    ecmaFeatures : {
        modules: true,
        sourceType: "module"
    },
    "parserOptions": {
        "ecmaVersion" : 6,
        "sourceType": "module",
        "ecmaFeatures": {
            "jsx": false,
            "experimentalObjectRestSpread": true
        }
    },
    globals : [
        'FB',
        'ga',
        'jQuery',
        '$',
        '_',
        'd3',
        'Router',
        'ttip',
        'Cookies',
        'fastdom',
        'describe',
        'beforeEach',
        'it',
        'expect',
        'assert',
        'done',
        'dataLayer',
        'validator'
    ],
    baseConfig: {
        //parser: 'babel-eslint',
    },
    envs: [
        'browser', 'es6'
    ]
};

var banner = `/**
 * multi-range / multi-range slider component
 * By Yair Even-Or (2017)
 * Don't sell this code. (c)
 * https://github.com/yairEO/multi-range
 */
`;



////////////////////////////////////////////////////
// Compile main app SCSS to CSS

gulp.task('scss', () => {
    return gulp.src('src/*.scss')
        .pipe(cssGlobbing({
            extensions: '.scss'
        }))
        .pipe(
            sass().on('error', sass.logError)
        )
        .pipe(combineMq()) // combine media queries
        .pipe( autoprefixer({ browsers:['last 7 versions'] }) )
        .pipe(gulp.dest('./dist'))
});



gulp.task('build_js', () => {
    var jsStream = gulp.src('src/'+NAME+'.js');

    lint(jsStream);

    return gulp.src('src/'+NAME+'.js')
        // https://www.npmjs.com/package/gulp-umd
        .pipe(umd(
            {
                namespace : (file) => 'multiRange'
            }
        ))
        .pipe(insert.prepend(banner))
        .pipe(gulp.dest('./dist/'))

});



gulp.task('minify', () => {
    gulp.src('dist/'+NAME+'.js')
        .pipe(uglify().on('error', gutil.log))
        .pipe(rename(NAME + '.min.js'))
        .pipe(gulp.dest('./dist/'))
});


function lint( stream ){
    return stream
        // eslint() attaches the lint output to the eslint property
        // of the file object so it can be used by other modules.
        .pipe(cache('linting'))
        .pipe(eslint(eslint_settings))
        // eslint.format() outputs the lint results to the console.
        // Alternatively use eslint.formatEach() (see Docs).
        .pipe(eslint.format())
        // To have the process exit with an error code (1) on
        // lint error, return the stream and pipe to failAfterError last.
        .pipe(eslint.failAfterError())
        .on('error', beep);
}


gulp.task('watch', () => {
    //gulp.watch('./images/sprite/**/*.png', ['sprite']);
    gulp.watch('./src/*.scss', ['scss']);
    gulp.watch('./src/*.js').on('change', ()=>{ runSequence('build_js', 'minify') });
});


gulp.task('default', ( done ) => {
    runSequence(['build_js', 'scss'], 'minify', 'watch', done);
});
