export interface ErrorResponse {
    message: string;
    error?: any;
    relevantInput?: any;
}

export interface PaginatedResponse<T> {
    size: number;
    data: T;
}
