
function showDetails(id) {
    document.getElementById(id).style.display = "flex";
    hideFormAdd();
    hideFormEdit(id);
}

function hideDetails(id) {
    document.getElementById(id).style.display = "none";
}

function showFormAdd() {
    document.getElementById('addForm').style.display='block';
    document.getElementById('addButton').style.display='none';
    hideFormEdit();
}

function hideFormAdd() {
    document.getElementById('addForm').style.display='none';
    document.getElementById('addButton').style.display='block';
}

function hideFormEdit(id) {
    var elements = document.getElementsByClassName('editForm');
    for (var i = 0; i < elements.length; i++) {
        elements[i].style.display = 'none';
    }
    var elements = document.getElementsByClassName('editButton');
    for (var i = 0; i < elements.length; i++) {
        elements[i].style.display = 'inline-block';
    }
}

function showFormEdit(id) {
    document.getElementById('editButton' + id).style.display = 'none';
    document.getElementById('editForm' + id).style.display = 'block'
    hideFormAdd();
}