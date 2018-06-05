import http from 'k6/http';

export default function() {
    http.get('http://localhost:3000');
    http.get('http://localhost:3000/tables/foo')
    http.get('http://localhost:3000/tables/bar')
}
