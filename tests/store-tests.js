/* global DevExpress */
(function (QUnit, $, DX, undefined) {

    var dataNs = DX.data,
        JayDataStore = dataNs.JayDataStore;

    var NO_PASARAN_MESSAGE = "Shouldn't reach this point";

    var HTTP_STATUSES = {
        OK: 200,
    };
    var HTTP_WEBAPI_ODATA_RESPONSE_HEADERS = {
        "DataServiceVersion": 3.0,
        "Content-Type": "application/json;charset=utf-8"
    };

    var DEFAULT_ENTITY_NAME = "Entity";
    var DEFAULT_SERVICE_NAME = "Service";
    var DEFAULT_ENTITY_CONTEXT_NAME = "Context";

    $data.Entity.extend("Entity", {
        id: {
            key: true,
            type: Number
        },
        name: {
            key: false,
            type: String
        },
        description: {
            key: false,
            type: String
        },
        referenceToAnotherEntity: {
            type: "AnotherEntity",
            inverseProperty: "referenceToEntity",
            required: true
        }
    });

    $data.Entity.extend("AnotherEntity", {
        id: {
            key: true,
            type: Number
        },
        name: {
            key: false,
            type: String
        },
        referenceToEntity: {
            type: "Entity",
            inverseProperty: "referenceToAnotherEntity"
        }
    });

    $data.EntityContext.extend("Context", {
        Entities: { type: $data.EntitySet, elementType: "Entity" },
        AnotherEntities: { type: $data.EntitySet, elementType: "AnotherEntity"}
    });

    var ctx = new Context({
        name: "oData",
        oDataServiceHost: DEFAULT_SERVICE_NAME
    });

    function createJayDataStore(options) {
        return new JayDataStore($.extend({
            queryable: ctx.Entities
        }, options));
    }

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

    QUnit.test("ctor signatures", function (assert) {
        assert.throws(function () {
            new JayDataStore();
        });

        assert.throws(function () {
            new JayDataStore({});
        });

        var store = new JayDataStore(ctx.Entities);
        assert.strictEqual(store.queryable(), ctx.Entities);
    });

    QUnit.test("load", function (assert) {
        var done = assert.async();

        this.server.respondWith([
            HTTP_STATUSES.OK,
            HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
            JSON.stringify({
                d: {
                    results: [
                        { id: 1, name: "foo" },
                        { id: 2, name: "bar" }
                    ]
                }
            })
        ]);

        createJayDataStore()
            .load()
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (results, extra) {
                assert.equal(results.length, 2);

                assert.equal(results[0].id, 1);
                assert.equal(results[0].name, "foo");

                assert.equal(results[1].id, 2);
                assert.equal(results[1].name, "bar");

                assert.ok($.isEmptyObject(extra));
            })
            .always(done);
    });

    QUnit.test("load (with-options)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(decodeURIComponent(request.url), "Service/Entities?$inlinecount=allpages&$expand=referenceToAnotherEntity&$filter=(name eq 'foo')&$orderby=name desc");

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({ d: { results: [] } }));
        });

        createJayDataStore()
            .load({
                sort: {
                    field: "name",
                    desc: true
                },
                filter: ["name", "foo"],
                expand: ["referenceToAnotherEntity"],
                requireTotalCount: true
            })
            .always(done);
    });

})(QUnit, jQuery, DevExpress);