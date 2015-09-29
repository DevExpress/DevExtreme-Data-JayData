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

    $data.Entity.extend("EntityWithCompoundKey", {
        id1: { type: "int", key: true },
        id2: { type: "int", key: true }
    });

    $data.EntityContext.extend("Context", {
        Entities: { type: $data.EntitySet, elementType: "Entity" },
        AnotherEntities: { type: $data.EntitySet, elementType: "AnotherEntity" },
        EntitiesWithCompoundKey: { type: $data.EntitySet, elementType: "EntityWithCompoundKey" }
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

            ctx.Entities
                .entityContext
                .stateManager
                .reset();

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

    QUnit.test("byKey (simple key)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(decodeURIComponent(request.url), "Service/Entities?$filter=(id eq 1)");

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: { value: {} }
                }));
        });

        createJayDataStore({ key: "id" })
            .byKey(1)
            .always(done);
    });

    QUnit.test("byKey (complex key)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(decodeURIComponent(request.url), "Service/EntitiesWithCompoundKey?$filter=((id1 eq 1) and (id2 eq 2))");

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: { value: {} }
                }));
        });

        createJayDataStore({ queryable: ctx.EntitiesWithCompoundKey, key: ["id1", "id2"] })
            .byKey({
                "id1": 1,
                "id2": 2,
                "it should be ignored": "it will be ignored"
            })
            .always(done);
    });

    QUnit.test("key and keyOf", function (assert) {
        var store = createJayDataStore();

        assert.equal(store.key(), "id");
        assert.equal(store.keyOf({ id: "value" }), "value");

        store = createJayDataStore({ queryable:
            ctx.EntitiesWithCompoundKey
        });

        assert.deepEqual(store.key(), [
            "id1",
            "id2"
        ]);

        assert.deepEqual(store.keyOf({ id1: "abc", id2: "xyz" }), { id1: "abc", id2: "xyz" });
    });

    QUnit.test("update", function (assert) {
        var done = assert.async();

        var store = createJayDataStore();
        var entity = store.queryable()
            .attachOrGet({ id: 1, name: "foo" });

        assert.equal(entity.entityState, $data.EntityState.Unchanged);

        store.update(1, { name: "bar" })
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (key, values) {
                assert.equal(key, 1);
                assert.deepEqual(values, { name: "bar" });

                assert.equal(entity.entityState, $data.EntityState.Modified);
            })
            .always(done);
    });

    QUnit.test("update (autoCommit=true)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: {
                        id: 1,
                        name: "bar"
                    }
                }));
        });

        var store = createJayDataStore({ autoCommit: true });
        var entity = store.queryable()
            .attachOrGet({ id: 1, name: "foo" });

        assert.equal(entity.entityState, $data.EntityState.Unchanged);

        store.update(1, { name: "bar" })
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (key, values) {
                assert.equal(key, 1);
                assert.deepEqual(values, { name: "bar" });

                assert.equal(entity.name, "bar");
                assert.equal(entity.entityState, $data.EntityState.Unchanged);
            })
            .always(done);
    });

    QUnit.test("insert", function (assert) {
        var done = assert.async();

        var store = createJayDataStore();

        store.insert({ id: 1, name: "foo" })
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (values, key) {
                assert.equal(key, 1);
                assert.deepEqual(values, { id: 1, name: "foo" });

                var entity = store.queryable()
                    .attachOrGet({ id: 1 });

                assert.equal(entity.id, 1);
                assert.equal(entity.name, "foo");
                assert.equal(entity.entityState, $data.EntityState.Added);
            })
            .always(done);
    });

    QUnit.test("insert (autoCommit=true)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: {
                        id: 1,
                        name: "foo"
                    }
                }));
        });

        var store = createJayDataStore({ autoCommit: true });

        store.insert({ id: 1, name: "foo" })
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (values, key) {
                assert.equal(key, 1);
                assert.deepEqual(values, { id: 1, name: "foo" });

                var tracked = store.entityContext().stateManager.trackedEntities;
                assert.equal(tracked.length, 0);
            })
            .always(done);
    });

    QUnit.test("remove", function (assert) {
        var done = assert.async();

        var store = createJayDataStore();
        var entity = store.queryable()
            .attachOrGet({ id: 1, name: "foo" });

        assert.equal(entity.entityState, $data.EntityState.Unchanged);

        store.remove(1)
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (key) {
                assert.equal(key, 1);

                assert.equal(entity.entityState, $data.EntityState.Deleted);
            })
            .always(done);
    });

   QUnit.test("remove (autoCommit=true)", function (assert) {
       var done = assert.async();

       this.server.respondWith(function (request) {
           request.respond(
               HTTP_STATUSES.OK,
               HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
               JSON.stringify({
                   d: {
                       id: 1,
                       name: "foo"
                   }
               }));
       });

       var store = createJayDataStore({ autoCommit: true });
       var entity = store.queryable()
           .attachOrGet({ id: 1, name: "foo" });

       assert.equal(entity.entityState, $data.EntityState.Unchanged);

       store.remove(1)
           .fail(function () {
               assert.ok(false, NO_PASARAN_MESSAGE);
           })
           .done(function (key) {
               assert.equal(key, 1);

                var tracked = store.entityContext().stateManager.trackedEntities;
                assert.equal(tracked.length, 0);
           })
           .always(done);
   });

})(QUnit, jQuery, DevExpress);