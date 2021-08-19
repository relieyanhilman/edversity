const tambahMentor = document.querySelector('.tambahMentor')

const inputNama = document.querySelector('.nama')
const inputJurusan = document.querySelector('.jurusan')
const inputUsername = document.querySelector('.username')
const inputEmail = document.querySelector('.email')
const inputPassword = document.querySelector('.password')

const tableBody = document.querySelector('.tableBody')
const empty = document.querySelector('.none')

const dataMentor = [{}]

const currentNumbOfData = 0

  var t = $('#dataTable').DataTable();
  var counter = 1;

  $('.tambahMentor').on( 'click', function () {
    empty.style.display = 'none'
    dataMentor[currentNumbOfData].nama = inputNama.value
    dataMentor[currentNumbOfData].jurusan = inputJurusan.value
    dataMentor[currentNumbOfData].username = inputUsername.value
    dataMentor[currentNumbOfData].email = inputEmail.value
    dataMentor[currentNumbOfData].password = inputPassword.value
      console.log(dataMentor);
      t.row.add( [
        `${dataMentor[currentNumbOfData].nama}`,
        `${dataMentor[currentNumbOfData].nama}`,
        `${dataMentor[currentNumbOfData].nama}`,
        `${dataMentor[currentNumbOfData].nama}`,
        `${dataMentor[currentNumbOfData].nama}`
      ] ).draw( false );
      currentNumbOfData++
  } );


// tambahMentor.addEventListener('click', function() {

  // empty.style.display = 'none'
  // dataMentor[currentNumbOfData].nama = inputNama.value
  // dataMentor[currentNumbOfData].jurusan = inputJurusan.value
  // dataMentor[currentNumbOfData].username = inputUsername.value
  // dataMentor[currentNumbOfData].email = inputEmail.value
  // dataMentor[currentNumbOfData].password = inputPassword.value
//   tableBody.innerHTML += `<tr>
//       <td>${dataMentor[currentNumbOfData].nama}</td>
//       <td>${dataMentor[currentNumbOfData].jurusan}</td>
//       <td>${dataMentor[currentNumbOfData].username}</td>
//       <td>${dataMentor[currentNumbOfData].email}</td>
//       <td>${dataMentor[currentNumbOfData].password}</td>
//   </tr>
// `
//   currentNumbOfData++
// })