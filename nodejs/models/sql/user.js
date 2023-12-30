'use strict';
const { Model } = require('sequelize');

const bcrypt = require('bcrypt');
const saltRounds = 10;

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.hasMany(models.AuthToken, {foreignKey: 'created_by'})
    }

    static async login(data){
      try{
        let user = await this.findByPk(data.username);

        if(await bcrypt.compare(data.password, user.password)){
          return user
        }else{
          throw new Error('Login failed!');
        }
      }catch(error){
        console.error('sql user login error:', error);
        throw new Error('Login failed!');
      }
    }
  }
  User.init({
    username:{
      type: DataTypes.STRING,
      primaryKey: true,
      unique: true,
    },
    password: DataTypes.STRING
  }, {
    sequelize,
    modelName: 'User',
    sync: true,
    hooks: {
      beforeCreate: async (user) => {
          if (user.password) {
              user.password = await bcrypt.hash(user.password, saltRounds);
          }
      },
      beforeUpdate: async (user) => {
          if (user.password) {
              user.password = await bcrypt.hash(user.password, saltRounds);
          }
      }
    }
  });
  return User;
};
