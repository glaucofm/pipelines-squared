import { Injectable } from "@angular/core";

@Injectable()
export class StorageService {

    public static save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    public static load(key): any {
        if (localStorage.getItem(key)) {
            return JSON.parse(localStorage.getItem(key));
        }
    }

}
