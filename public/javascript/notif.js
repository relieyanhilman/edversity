const notification = document.querySelectorAll('#inboxModal')
notification.forEach(notifications => {
  notifications.innerHTML = `<div class="modal-dialog">
  <div class="modal-content">
    <div class="modal-body">
      <div class="row mt-1">
        <div class="col-1">
          <i class="fa mt-1 fs-3 fa-bell primary-color me-2"></i>
        </div>
        <div class="col" style="line-height: 0.4">
          <h5>Request kelas telah disetujui</h5>
          <label class="inbox-label">Cek selengkapnya untuk memilih mentor</label>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-1">
          <i class="fa mt-1 fs-3 fa-tag primary-color me-2"></i>
        </div>
        <div class="col" style="line-height: 0.4">
          <h5>Promo Kelas</h5>
          <label class="inbox-label">Cek selengkapnya untuk memilih mentor</label>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-1">
          <i class="fa mt-1 fs-3 fa-tag primary-color me-2"></i>
        </div>
        <div class="col" style="line-height: 0.4">
          <h5>Request Kelas telah di tolak</h5>
          <label class="inbox-label">Cek selengkapnya untuk memilih mentor</label>
        </div>
      </div>
      <div class="row mt-3">
        <div class="col-1">
          <i class="fa mt-1 fs-3 fa-check primary-color me-2"></i>
        </div>
        <div class="col" style="line-height: 0.4">
          <h5>Verifikasi Akun Anda</h5>
          <label class="inbox-label">Cek selengkapnya untuk memilih mentor</label>
        </div>
      </div>

      <a class="btn primary-outline w-100 mt-4" href="edmessage.html">Lihat Semua</a>
    </div>
  </div>
</div>`
})
