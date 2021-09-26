const navbar = document.querySelectorAll(".navbar")
navbar.forEach(navs=> {
  navs.innerHTML = `<div class="container-fluid">
  <a class="navbar-brand ms-3" href="/dashboard-student"><img src="/IMG/logo.svg" /></a>
  <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent" aria-expanded="false" aria-label="Toggle navigation">
    <span class="navbar-toggler-icon"></span>
  </button>
  <div class="collapse navbar-collapse" id="navbarSupportedContent">
    <ul class="navbar-nav me-auto mb-2 mb-lg-0">
      <li class="nav-item">
        <a class="nav-link active" aria-current="page" href="/dashboard-student">Home</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/edpedia">ed.pedia</a>
      </li>
      <li class="nav-item">
        <a class="nav-link" href="/dashboard-student/edwallet" tabindex="-1">ed.wallet</a>
      </li>
      <li class="nav-item">
        <a style="color: #fff100 !important" class="nav-link" href="/buka-kelas">
          BUKA KELAS
        </a>
      </li>
    </ul>
    <div class="d-flex">
      <!-- Notif -->
      <!-- data-bs-toggle="modal" data-bs-target="#inboxModal" -->
      <a href="edmessage.html" class="nav-link" >
        <i style="font-size: 1.4rem;" class="fa fa-bell text-light"></i>
      </a>
      <div class="input-search">
        <input class="input-field" name="search" id="search" placeholder="Search" />
        <button type="submit" class="btn"><i class="fa fa-search text-light"> </i></button>
      </div>

      <a href="/dashboard-student/profile/" class="nav-link">
        <i style="font-size: 1.6rem;" class="fa fa-sliders text-light"></i>
      </a>
    </div>
  </div>
</div>`

})