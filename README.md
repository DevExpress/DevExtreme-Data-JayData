[![Build Status](https://img.shields.io/shippable/55f6e4281895ca44741526e5.svg)](https://app.shippable.com/projects/55f6e4281895ca44741526e5)

DevExtreme JayData data layer extension
===========================

The JayData extension enables your DevExtreme application to work with an OData service accessed via the [JayData](http://jaydata.org/) library. The extension includes the JayDataStore class that wraps the JayData functionality with the [Store](http://js.devexpress.com/Documentation/Howto/Data_Layer/Data_Layer#Data_Layer_Data_Layer_Creating_DataSource_What_Are_Stores) interface accepted within the [DevExtreme data layer](http://js.devexpress.com/Documentation/Howto/Data_Layer/Data_Layer#Overview). 
To create a JayDataStore instance, call its constructor and pass the required configuration object to it. The configuration object may contain the following fields:
 - ```queryable``` - Required. Takes on the JayData entity that should be accessed via this JayDataStore instance.
 - ```autoCommit``` - Optional. Specifies whether the changes made to the data are immediately committed to the server. The default value is false.

``` 
$data.Entity.extend("MyEntity", {
    id: { type: "int", key: true, computed: true },
    name: { type: String }
});
$data.EntityContext.extend("Database", { MyEntities: { type: $data.EntitySet, elementType: "MyEntity" }});

var dataBase = new Database({
    name: "oData",
    oDataServiceHost: ROOT_URL + "FakeOData"
});
//queryable only
dataBase.onReady().then(function() {
	var jdStore = new DevExpress.data.JayDataStore(dataBase.MyEntities);
});
//queryable with custom filter
dataBase.onReady().then(function() {
	var jdStore = new DevExpress.data.JayDataStore(dataBase.MyEntities.filter("it.name.startsWith('A')"));
});
//queryable and autoCommit
dataBase.onReady().then(function() {
	var jdStore = new DevExpress.data.JayDataStore({
		queryable: dataBase.MyEntities,
		autoCommit: true
	});
});
```

You can [read](http://js.devexpress.com/Documentation/Howto/Data_Layer/Data_Layer#Reading_Data) and [modify](http://js.devexpress.com/Documentation/Howto/Data_Layer/Data_Layer#Data_Modification) data associated with the current JayDataStore instance in the same way as data associated with any other Store. 
Besides the standard Store methods, the JayDataStore contains several JayData specific methods.
 - ```queryable()``` - returns the JayData entity object associated with this JayDataStore.
 - ```entityType()``` - returns the type of the entity associated with this JayDataStore instance.
 - ```entityContext()``` - returns the JayData context containing the entity associated with this JayDataStore instance.

```
var jdStore = new DevExpress.data.JayDataStore(dataBase.MyEntities);
jdStore.insert({
	id: 1,
	name: "EntityName"
}).done(function(values, id) {
	console.log(jdStore.entityType());
	console.log(jdStore.queryable().stateManager.trackedEntities);
	jdStore.entityContext().saveChanges();
});
```
**NOTE:** JayData extension requires the application to reference oDataProvider.js or oDataProvider.min.js.

