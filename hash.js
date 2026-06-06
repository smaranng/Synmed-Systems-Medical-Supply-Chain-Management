const bcrypt = require('bcrypt');

const password = 'medplus';

bcrypt.genSalt(10, (err, salt) => {
  bcrypt.hash(password, salt, (err, hash) => {
    if (err) throw err;
    console.log('Hashed Password:', hash);
  });
});
