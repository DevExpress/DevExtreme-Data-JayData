/// <reference path="../data/data.store.d.ts" />  
/// <reference path="../jaydata.d.ts" />
declare module DevExpress.data {
    export interface JayDataStoreOptions extends StoreOptions {
        autoCommit?: boolean;
        queryable: $data.Queryable<$data.Entity>;
    }
    export class JayDataStore extends Store {
        constructor(queryable: $data.Queryable<$data.Entity>);
        constructor(options: JayDataStoreOptions);

        public queryable(): $data.Queryable<$data.Entity>;
        public entityType(): string;
        public entityContext(): $data.EntityContext;
    }
}