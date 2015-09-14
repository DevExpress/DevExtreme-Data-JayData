$(function () {
    QUnit.test("exists", function (assert) {
        assert.ok("JayDataStore" in DevExpress.data);
    });
});