var gulp = require("gulp"),
    karma = require("karma"),
    qunit = require("gulp-qunit");

gulp.task("run", function (done) {
    new karma.Server({
        signleRun: true,
        configFile: __dirname + "/karma.conf.js"
    }, done).start();
});