export interface ErrorResponse {
    message: string;
    input: any;
}

export interface PaginatedResponse<T> {
    size: number;
    data: T;
}
