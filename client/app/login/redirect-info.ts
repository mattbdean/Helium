export interface RedirectInfo {
    user: string;
    host: string;
    path: string;
    query: { [key: string]: string };
}
