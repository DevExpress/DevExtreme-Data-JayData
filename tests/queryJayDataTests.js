/* global $data */
(function (QUnit, $, DX, undefined) {

    var dataNs = DX.data;
    var NO_PASARAN_MESSAGE = "Shouldn't reach this point";

    var DEFAULT_ENTITY_NAME = "Entity";
    var DEFAULT_SERVICE_NAME = "Service";
    var DEFAULT_ENTITY_CONTEXT_NAME = "Context";


    var HTTP_STATUSES = {
        OK: 200,
    };
    var HTTP_WEBAPI_ODATA_RESPONSE_HEADERS = {
        "DataServiceVersion": 3.0,
        "Content-Type": "application/json;charset=utf-8"
    };

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

    function createJayDataQuery(options) {
        return dataNs.queryImpl.jayData(ctx.Entities, options);
    }

    QUnit.module("[Query-tests]", {
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
        assert.ok("jayData" in dataNs.queryImpl);
    });

    QUnit.test("enumerate", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(
                "Service/Entities",
                decodeURIComponent(request.url)
                );

            request.respond(
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
                );
        });

        createJayDataQuery()
            .enumerate()
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

    QUnit.test("enumerate (with requireTotalCount)", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(
                "Service/Entities?$inlinecount=allpages",
                decodeURIComponent(request.url)
                );

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: {
                        results: [
                            { id: 1, name: "foo" },
                            { id: 2, name: "bar" }
                        ],
                        __count: 2
                    }
                })
                );
        });

        createJayDataQuery({ requireTotalCount: true })
            .enumerate()
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (results, extra) {
                assert.equal(results.length, 2);

                assert.equal(results[0].id, 1);
                assert.equal(results[0].name, "foo");

                assert.equal(results[1].id, 2);
                assert.equal(results[1].name, "bar");

                assert.deepEqual(extra, {
                    totalCount: 2
                });
            })
            .always(done);
    });

    QUnit.test("sortBy / thenBy", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(
                "Service/Entities?$orderby=name desc,description,referenceToAnotherEntity/name",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .sortBy("name", true)
            .thenBy("description")
            .thenBy("referenceToAnotherEntity.name")
            .enumerate()
            .always(done);

    });

    QUnit.test("thenBy cannot be called before sortBy", function (assert) {
        assert.throws(function () {
            createJayDataQuery().thenBy("name");
        });
    });

    QUnit.test("grouping throws", function (assert) {
        assert.throws(function () {
            createJayDataQuery().groupBy();
        });
    });

    QUnit.test("select", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {
            assert.equal(
                "Service/Entities?$select=name",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .select("name")
            .enumerate()
            .always(done);
    });

    QUnit.test("expand", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$expand=referenceToAnotherEntity",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .expand("referenceToAnotherEntity")
            .enumerate()
            .always(done);
    });

    QUnit.test("select and implicit expand", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$expand=referenceToAnotherEntity,referenceToAnotherEntity&$select=name,referenceToAnotherEntity/id,referenceToAnotherEntity/name",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .select(
                "name",
                "referenceToAnotherEntity.id",
                "referenceToAnotherEntity.name"
                )
            .enumerate()
            .always(done);
    });

    QUnit.test("slice", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$top=2&$skip=1",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .slice(1, 2)
            .enumerate()
            .always(done);
    });

    // NOTE: JayData requires the take and skip expressions to be the last in chain
    QUnit.test("slice:order", function (assert) {
        var all,
            done = assert.async();

        this.server.respondWith(function (request) {
            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        all = [
            createJayDataQuery()
                .slice(1, 2)
                .sortBy("name", true)
                .enumerate(),
            createJayDataQuery()
                .sortBy("name", true)
                .slice(1, 2)
                .filter("id", ">", 1)
                .enumerate(),
            createJayDataQuery({ requireTotalCount: true })
                .slice(1, 2)
                .enumerate()
        ];
        $.when.apply($, all)
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function () {
                assert.ok(true);
            })
            .always(done);
    });

    QUnit.test("filter:simple", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$filter=(id ne 1)",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .filter("id", "<>", 1)
            .enumerate()
            .always(done);
    });

    QUnit.test("filter:complex #1", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$filter=(((id ne 1) or ((id eq 2) and (name eq 'bar'))) and (name eq 'foo'))",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .filter([
                [
                    ["id", "<>", 1],
                    "or",
                    [
                        ["id", 2],
                        ["name", "bar"]
                    ]
                ],
                "and",
                ["name", "foo"]
            ])
            .enumerate()
            .always(done);
    });

    QUnit.test("filter:complex #2", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$filter=((id eq 1) and (substringof('a',name) or substringof('b',description)))",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .filter([
                ["id", "=", 1],
                "and",
                [
                    ["name", "contains", "a"],
                    "or",
                    ["description", "contains", "b"]
                ]
            ])
            .enumerate()
            .always(done);
    });

    QUnit.test("filter:complex #3", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$filter=(((id eq 1) or (id eq 2)) or (id eq 3))",
                decodeURIComponent(request.url)
                );

            request.respond(HTTP_STATUSES.OK, HTTP_WEBAPI_ODATA_RESPONSE_HEADERS, JSON.stringify({
                d: { results: [] }
            }));
        });

        createJayDataQuery()
            .filter([
                ["id", 1],
                "or",
                ["id", 2],
                "or",
                ["id", 3]
            ])
            .enumerate()
            .always(done);
    });

    QUnit.test("filter:all operations", function (assert) {
        var done = assert.async();

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$filter=((((((((((name eq 'bar') and (name gt 'bar')) and (name lt 'bar')) and (name ne 'bar')) and (name ge 'bar')) and (name le 'bar')) and endswith(name,'bar')) and startswith(name,'bar')) and substringof('bar',name)) and not(substringof('bar',name)))",
                decodeURIComponent(request.url)
                );

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: { results: [] }
                }));
        });

        createJayDataQuery()
            .filter([
                ["name", "=", "bar"],
                ["name", ">", "bar"],
                ["name", "<", "bar"],
                ["name", "<>", "bar"],
                ["name", ">=", "bar"],
                ["name", "<=", "bar"],
                ["name", "endswith", "bar"],
                ["name", "startswith", "bar"],
                ["name", "contains", "bar"],
                ["name", "notcontains", "bar"]
            ])
            .enumerate()
            .always(done);
    });

    QUnit.test("filter:mixin and/or operators are not allowed", function (assert) {
        assert.throws(function () {
            createJayDataQuery()
                .filter([
                    ["id", 1],
                    "and",
                    ["id", "<", 1],
                    "or",
                    ["id", ">", 1]
                ])
                .enumerate();
        });

        assert.throws(function () {
            createJayDataQuery()
                .filter([
                    ["id", 1],
                    ["id", "<", 1],
                    "or",
                    ["id", ">", 1]
                ])
                .enumerate();
        });

        assert.throws(function () {
            createJayDataQuery()
                .filter([
                    ["id", 1],
                    "or",
                    ["id", "<", 1],
                    ["id", ">", 1]
                ])
                .enumerate();
        });
    });

    QUnit.test("filter:user can pass his own Queryable", function (assert) {
        var done = assert.async();
        var queryable = ctx.Entities
            .order("id")
            .filter("it.id == 1");

        this.server.respondWith(function (request) {

            assert.equal(
                "Service/Entities?$orderby=id&$filter=((id eq 1) and (id eq 2))&$top=2&$skip=1",
                decodeURIComponent(request.url)
                );

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: { results: [] }
                }));
        });

        dataNs.queryImpl.jayData(queryable)
            .filter(["id", 2])
            .slice(1, 2)
            .enumerate()
            .always(done);
    });

    QUnit.test("count", function (assert) {
        var done = assert.async(),
            expectedCount = 42;

        this.server.respondWith(function (request) {

            assert.equal(
                decodeURIComponent(request.url),
                "Service/Entities?$inlinecount=allpages&$top=0"
                );

            request.respond(
                HTTP_STATUSES.OK,
                HTTP_WEBAPI_ODATA_RESPONSE_HEADERS,
                JSON.stringify({
                    d: {
                        __count: expectedCount
                    }
                })
                );
        });

        createJayDataQuery()
            .count()
            .fail(function () {
                assert.ok(false, NO_PASARAN_MESSAGE);
            })
            .done(function (value) {
                assert.equal(value, expectedCount);
            })
            .always(done);
    });

})(QUnit, jQuery, DevExpress);