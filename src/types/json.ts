/**
 * Represents a JSON value.
 *
 * It is recommended to use this type instead of `any` when working with data that originates from or is intended for
 * JSON serialization.
 */
 export type Json = boolean | number | string | null | JsonArray | JsonMap | undefined;

 /**
  * Represents a JSON object.
  */
 export type JsonMap = { [key: string]: Json; }

 /**
  * Represents a JSON array.
  */
 export type JsonArray = Array<Json>;
