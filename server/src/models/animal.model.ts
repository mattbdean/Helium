import { DataTypes, Sequelize } from 'sequelize';

export default function animal(sequelize: Sequelize, types: DataTypes) {
    return sequelize.define('animal', {
        subject_id: { type: types.INTEGER },
        tag: { type: types.STRING },
        date_of_birth: { type: types.DATE }
    });
}
