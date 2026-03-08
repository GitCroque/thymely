import {
  UseFiltersColumnOptions,
  UseFiltersColumnProps,
  UseFiltersInstanceProps,
  UseFiltersOptions,
  UseFiltersState,
  UseGlobalFiltersColumnOptions,
  UseGlobalFiltersInstanceProps,
  UseGlobalFiltersOptions,
  UseGlobalFiltersState,
  UsePaginationInstanceProps,
  UsePaginationOptions,
  UsePaginationState,
} from "react-table";

declare module "react-table" {
  export interface TableOptions<D extends Record<string, unknown>>
    extends UseFiltersOptions<D>,
      UseGlobalFiltersOptions<D>,
      UsePaginationOptions<D> {}

  export interface TableInstance<D extends Record<string, unknown>>
    extends UseFiltersInstanceProps<D>,
      UseGlobalFiltersInstanceProps<D>,
      UsePaginationInstanceProps<D> {}

  export interface TableState<D extends Record<string, unknown>>
    extends UseFiltersState<D>,
      UseGlobalFiltersState<D>,
      UsePaginationState<D> {}

  export interface ColumnInterface<D extends Record<string, unknown>>
    extends UseFiltersColumnOptions<D>,
      UseGlobalFiltersColumnOptions<D> {}

  export interface ColumnInstance<D extends Record<string, unknown>>
    extends UseFiltersColumnProps<D> {}
}
