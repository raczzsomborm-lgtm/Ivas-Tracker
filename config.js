/*
  A Firebase projekt (ivas-tracker) beállításai.
  Ezek az adatok nem titkosak, a védelmet a firestore.rules szabályai adják.
*/
window.STRIGULA_FIREBASE = {
  apiKey: "AIzaSyBr0jjnI3gAACGwK7OLsEWRB842GF5LfYo",
  authDomain: "ivas-tracker.firebaseapp.com",
  projectId: "ivas-tracker",
  storageBucket: "ivas-tracker.firebasestorage.app",
  messagingSenderId: "717444729718",
  appId: "1:717444729718:web:757d3cc99fff460bcdc857"
};

/*
  Az üzemeltető (adatkezelő) neve és elérhetősége: ez jelenik meg a Felhasználási feltételekben és az
  adatkezelési tájékoztatóban.
*/
window.MASNAPLO_PRIVACY = {
  controller: "Rácz Zsombor Marcell",
  contact: "racz.zsomborm@gmail.com"
};

/*
  A tulajdonos fiókazonosítója (UID). Ugyanez áll a firestore.rules fájl elején lévő ownerUid() részben is.
  Ez itt csak a Tulajdonos menüt jeleníti meg; a jogot a szerver adja a szabályok alapján.
*/
window.MASNAPLO_OWNER_UID = "3hTaBCw1TYdBJt4mfVm3w0mEm7y1";
