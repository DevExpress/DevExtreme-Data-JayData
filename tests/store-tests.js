/* global DevExpress */
(function (QUnit, $, DX, undefined) {

    var dataNs = DX.data;
    var NO_PASARAN_MESSAGE = "Shouldn't reach this point";

    var HTTP_STATUSES = {
        OK: 200,
    };
    var HTTP_WEBAPI_ODATA_RESPONSE_HEADERS = {
        "DataServiceVersion": 3.0,
        "Content-Type": "application/json;charset=utf-8"
    };

    QUnit.module("[Store-tests]", {
        beforeEach: function () {
            this.server = sinon.fakeServer.create({
                respondImmediately: true
            });
        },
        afterEach: function () {
            this.server.restore();
        }
    });

    QUnit.test("exists", function (assert) {
        assert.ok("JayDataStore" in dataNs);
    });

})(QUnit, jQuery, DevExpress);