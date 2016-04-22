(function($, DX, undefined) {
    var dataNs = DX.data,
    
        utilsNs = DX.require("/utils/utils.common"),
        __isArray = utilsNs.isArray,
        __isNumber = utilsNs.isNumber,
        
        __camelize = DX.require("/utils/utils.inflector").camelize;
        
    var jayDataQuery = function(queryable, queryOptions, tasks) {
        if(!("$data" in window))
            throw Error("JayData library is required");
            
        if (!(queryable instanceof $data.Queryable))
            throw Error("Invalid argument passed: queryable");
            
        var handleError = function(error) {
            var errorHandler = queryOptions.errorHandler;

            if (errorHandler)
                errorHandler(error);

            dataNs._errorHandler(error);
        };
        
        var applyTasks = function(tasks) {
            $.each(tasks, function () {
                queryable = queryable[this.action].apply(queryable, this.params);
            });

            return queryable;
        };

        var derivedQuery = function(actionName, params) {
            return jayDataQuery(
                queryable,
                queryOptions,
                tasks.concat({
                    action: actionName,
                    params: params
                }));
        };
        
        var formatSortClause = function(field, desc) {
            return desc ? "-".concat(field) : field;
        };
        
        var sortBy = function(field, desc) {
            return derivedQuery("order", [formatSortClause(field, desc)]);
        };

        var thenBy = function(field, desc) {
            var lastTask = tasks[tasks.length - 1];

            if (!lastTask || lastTask.action !== "order")
                throw DX.Error("E4004");

            return sortBy(field, desc);
        };
        
        var slice = function(skip, take) {
            var newTasks = [];

            if (skip)
                newTasks.push({ action: "skip", params: [skip] });

            if (take)
                newTasks.push({ action: "take", params: [take] });

            return jayDataQuery(queryable, queryOptions, tasks.concat(newTasks));
        };
        
        var select = function(expr) {
            /* jshint evil:true */
            var fields = [];

            if (!__isArray(expr))
                expr = $.makeArray(arguments);

            $.each(expr, function() {
                var key, 
                    value = String(this);
                
                key = value.indexOf(".") === -1
                    ? value
                    : __camelize(value.replace(/\./g, "-"));

                fields.push([key, ":", "entity.", value].join(""));
            });

            return derivedQuery("map", [new Function("entity", "return { " + fields.join() + "};")]);
        };

        var expand = function(expr) {
            if (!$.isArray(expr))
                expr = $.makeArray(arguments);
                
            return derivedQuery("include", expr);
        };
        
        var filter = function(criteria) {
            if (!__isArray(criteria))
                criteria = $.makeArray(arguments);
                
            return derivedQuery("filter", [compileCriteria(criteria)]);
        };

        var compileCriteria = function(criteria) {
            var translateBinaryOperator = function(operator) {
                switch(operator) {
                    case "=":
                        return "==";
                        
                    case "<>":
                        return "!=";
                        
                    case "endswith":
                        return ".endsWith";
                        
                    case "contains":
                        return ".contains";
                        
                    case "startswith":
                        return ".startsWith";
                        
                    case "notcontains":
                        return ".notcontains";
                    
                    default: return operator;
                }
            };
            
            var formatCriterion = function(operator, left, right) {
                var result,
                    shouldNegate = operator.indexOf(".not") === 0;

                if (shouldNegate)
                    operator = operator.replace("not", "");

                result = operator.charAt(0) === "."
                    ? [left, operator, "(", right, ")"].join("")
                    : [left, operator, right].join(" ");

                return shouldNegate ? "!(" + result + ")" : result;                
            };
            
            var compileCore = function(criteria) {
                if(__isArray(criteria[0]))
                    return compileGroup(criteria);
                     
                return compileBinary(criteria);
            };
            
            var compileGroup = function(criteria) {
                var groupOperands = [],
                    groupOperator,
                    nextGroupOperator;

                $.each(criteria, function() {
                    if (__isArray(this)) {
                        if (groupOperands.length > 1 && nextGroupOperator !== groupOperator)
                            throw Error("Mixing of and/or is not allowed inside a single group");

                        groupOperator = nextGroupOperator;
                        groupOperands.push(compileCore(this));
                        nextGroupOperator = " && ";
                    }
                    else {
                        nextGroupOperator = /and|&/i.test(this) ? " && " : " || ";
                    }
                });

                return groupOperands.length < 2 ? groupOperands[0] : "(" + groupOperands.join(groupOperator) + ")";
            };
            
            var compileBinary = function(criteria) {
                var left,
                    right,
                    operator;
                    
                criteria = dataNs.utils.normalizeBinaryCriterion(criteria);

                left = "it.".concat(criteria[0]);
                right = isFinite(criteria[2]) ? criteria[2] : "'" + criteria[2] + "'";
                operator = translateBinaryOperator(criteria[1].toLowerCase());

                return formatCriterion(operator, left, right);
            };
        
            return compileCore(criteria);
        };
        
        var enumerate = function() {
            var d = $.Deferred()
                        .fail(handleError);

            if (queryOptions.requireTotalCount)
                queryable = queryable.withInlineCount();

            queryable = applyTasks(tasks.sort(function(x, y) {
                var isSliceRE = /skip|take/i;

                if (isSliceRE.test(x.action))
                    return 1;

                if (isSliceRE.test(y.action))
                    return -1;

                return 0;
            }));

            queryable.toArray()
                .then(function(data) {
                    var extra = {};

                    if (queryOptions.requireTotalCount) {
                        extra.totalCount = __isNumber(data.totalCount)
                            ? data.totalCount
                            : -1;
                    }

                    d.resolve(data, extra);
                })
                .fail(d.reject);

            return d.promise();
        };

        var count = function() {
            var d = $.Deferred()
                        .fail(handleError),
                filteredTasks;

            filteredTasks = $.grep(tasks, function(task) {
                return !/map|order|take|skip/i.test(task.action);
            });

            queryable = applyTasks(filteredTasks);
            queryable.withInlineCount()
                .take(0)
                .toArray()
                .then(function(data) {
                    d.resolve(data.totalCount);
                })
                .fail(d.reject);

            return d.promise();
        };

        tasks = tasks || [];
        queryOptions = queryOptions || {};

        return {
            enumerate: enumerate,
            count: count,
            slice: slice,
            sortBy: sortBy,
            thenBy: thenBy,
            filter: filter,
            select: select,
            expand: expand,

            sum: DX.abstract,
            min: DX.abstract,
            max: DX.abstract,
            avg: DX.abstract,
            groupBy: DX.abstract,
            aggregate: DX.abstract
        };
    };

    var JayDataStore = dataNs.Store.inherit({
        ctor: function(options) {
            if (!$data)
                throw Error("JayData library is required");

            if (options instanceof $data.Queryable)
                options = {
                    queryable: options,
                    autoCommit: false
                };

            this.callBase(options);

            this._queryable = options.queryable;
            this._autoCommit = options.autoCommit;
            this._entityType = this._queryable.defaultType;
        },

        _customLoadOptions: function() {
            return ["expand", "queryable"];
        },

        createQuery: function(loadOptions) {
            loadOptions = loadOptions || {};
            var query = dataNs.queryImpl.jayData(
                loadOptions.queryable || this.queryable(),
                { errorHandler: this._errorHandler, requireTotalCount: loadOptions.requireTotalCount }
                );
            if (loadOptions.expand)
                query = query.expand(loadOptions.expand);
            return query;
        },

        queryable: function() {
            return this._queryable;
        },

        entityType: function() {
            return this._entityType;
        },

        entityContext: function() {
            return this.queryable().entityContext;
        },

        key: function() {
            var key,
                keysProps = this.queryable()
                    .elementType
                    .memberDefinitions
                    .getKeyProperties();

            if (!keysProps || !keysProps.length)
                return this._key;

            key = $.map(keysProps, function(key) {
                return key.name;
            });

            return key.length > 1 ? key : key[0];
        },

        _byKeyImpl: function(keyValue) {
            var d,
                key,
                type,
                predicate;

            var entity;

            this._requireKey();

            d = $.Deferred();
            key = this.key();
            type = this.entityType();

            $.each(this.entityContext().stateManager.trackedEntities,
                $.proxy(function(_, item) {
                    if (item.data.getType() !== type)
                        return true;
                    if (this.keyOf(item.data) !== keyValue)
                        return true;
                    if ($.inArray(item.data.entityState, [$data.EntityState.Deleted, $data.EntityState.Detached]) > -1)
                        return true;

                    entity = item.data;
                    return false;
                }, this)
                );

            if (entity) d.resolve(entity);
            else {
                predicate = !__isArray(key)
                    ? ["it.", key, "==", keyValue].join("")
                    : $.map(key, function(keyItem) {
                        return ["it.", keyItem, "==", keyValue[keyItem] || keyValue].join("");
                    }).join(" && ");
                this.queryable()
                    .filter(predicate)
                    .toArray()
                    .fail(d.reject)
                    .done(function(results) { d.resolve(results[0]); });
            }

            return d.promise();
        },

        _updateImpl: function(keyValue, values) {
            var d = $.Deferred();
            this.byKey(keyValue)
                .fail(d.reject)
                .done($.proxy(function(entity) {
                    this.queryable().attach(entity);
                    $.each(values, function(propName, propValue) {
                        entity.setProperty({ name: propName }, propValue);
                    });
                    if (!this._autoCommit)
                        d.resolve(keyValue, values);
                    else this.entityContext()
                        .saveChanges()
                        .fail(d.reject)
                        .done(function() { d.resolve(keyValue, values); });
                }, this));

            return d.promise();
        },

        _insertImpl: function(values) {
            var d = $.Deferred(),
                that = this,
                entity;

            entity = this.queryable().add(values);

            if (!this._autoCommit)
                d.resolve(values, this.keyOf(entity));
            else this.entityContext()
                .saveChanges()
                .fail(d.reject)
                .done(function() { d.resolve(values, that.keyOf(entity)); });

            return d.promise();
        },

        _removeImpl: function(keyValue) {
            var d = $.Deferred();

            this.byKey(keyValue)
                .fail(d.reject)
                .done($.proxy(function(entity) {
                    this.queryable().remove(entity);
                    if (!this._autoCommit)
                        d.resolve(keyValue);
                    else this.entityContext()
                        .saveChanges()
                        .fail(d.reject)
                        .done(function() { d.resolve(keyValue); });
                }, this));

            return d.promise();
        }
    });

    dataNs.JayDataStore = JayDataStore;
    dataNs.queryImpl.jayData = jayDataQuery;
    
})(jQuery, DevExpress);