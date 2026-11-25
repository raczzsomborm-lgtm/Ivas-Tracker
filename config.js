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
  Az adatkezelési tájékoztatóban megjelenő adatok. Ide írd a saját nevedet (te vagy az adatkezelő)
  és egy elérhetőséget (például e-mail-címet), ahol a barátaid az adataikkal kapcsolatban elérnek.
*/
window.MASNAPLO_PRIVACY = {
  controller: "Rácz Zsombor Marcell",
  contact: "racz.zsombor.marcell@gmail.com"
};

/*
  A tulajdonos fiókazonosítója (UID). Az appban: Beállítások, Fiók, Fiókazonosító (Másolás gomb).
  Ugyanezt kell beírni a firestore.rules fájl elején lévő ownerUid() részbe is, és ott Publish-olni.
  Ez itt csak a Tulajdonos menüt jeleníti meg; a jogot a szerver adja a szabályok alapján.
*/
window.MASNAPLO_OWNER_UID = "3hTaBCw1TYdBJt4mfVm3w0mEm7y1";
